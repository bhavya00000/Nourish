import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { foodsForUser } from "@/lib/foods";
import { nutritionFor, parsePhrase, searchFoods } from "@/lib/parser";

/** Type-ahead for the add-food box. Kept as a route so it can be debounced client-side. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const foods = await foodsForUser(user.id);
  // Search on the food words only, so "2 cup dal" still finds dal.
  const parsed = parsePhrase(query);
  const { query: words, unit } = parsed;
  // Fold "large" into the quantity, so the picked suggestion logs what it showed.
  const quantity = Math.round(parsed.quantity * parsed.sizeFactor * 100) / 100;

  const results = searchFoods(words, foods, 8).map(({ food, score }) => {
    const nutrition = nutritionFor(food, quantity, unit);
    return {
      id: food.id,
      name: food.name,
      source: food.source,
      score: Number(score.toFixed(2)),
      quantity,
      unit: nutrition.unit,
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      grams: nutrition.grams,
    };
  });

  return NextResponse.json({ results, parsed: { quantity, unit, query: words } });
}
