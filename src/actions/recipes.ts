"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { foodsForUser, findFood, toParsedFood } from "@/lib/foods";
import { interpret, nutritionFor } from "@/lib/parser";
import { AUTO_ACCEPT_CONFIDENCE, createEntry, isDate } from "@/lib/tracker";
import { MEALS } from "@/lib/nutrition";

const FOOD_SELECT = {
  id: true, name: true, aliases: true, kcal: true, protein: true, carbs: true, fat: true,
  fiber: true, sugar: true, sodium: true, units: true, veg: true, cuisine: true, tags: true, source: true,
} as const;

/** Totals for one serving of a recipe. */
export async function recipeTotals(recipeId: string, userId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, userId },
    include: { items: { include: { food: { select: FOOD_SELECT } } } },
  });
  if (!recipe) return null;

  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, grams: 0 };
  const lines = recipe.items.map((item) => {
    const nutrition = nutritionFor(toParsedFood(item.food), item.quantity, item.unit);
    totals.kcal += nutrition.kcal;
    totals.protein += nutrition.protein;
    totals.carbs += nutrition.carbs;
    totals.fat += nutrition.fat;
    totals.fiber += nutrition.fiber;
    totals.grams += nutrition.grams;
    return { id: item.id, name: item.food.name, quantity: item.quantity, unit: item.unit, kcal: nutrition.kcal, protein: nutrition.protein };
  });

  const servings = recipe.servings || 1;
  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    recipe: { id: recipe.id, name: recipe.name, kind: recipe.kind, meal: recipe.meal, servings, notes: recipe.notes },
    lines,
    total: { ...totals, kcal: Math.round(totals.kcal) },
    perServing: {
      kcal: Math.round(totals.kcal / servings),
      protein: round(totals.protein / servings),
      carbs: round(totals.carbs / servings),
      fat: round(totals.fat / servings),
      fiber: round(totals.fiber / servings),
      grams: round(totals.grams / servings),
    },
  };
}

export async function listRecipes() {
  const user = await requireUser();
  const recipes = await prisma.recipe.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return Promise.all(
    recipes.map(async (r) => {
      const detail = await recipeTotals(r.id, user.id);
      return detail!;
    })
  );
}

/**
 * Build a recipe from the same free text used everywhere else, so people can
 * paste "3 roti, 1 katori dal, 150 g curd" and get a reusable meal.
 */
export async function createRecipeAction(input: { name: string; text: string; kind?: string; meal?: string; servings?: number; notes?: string }) {
  const user = await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give it a name.").max(80),
      text: z.string().trim().min(1, "List what goes into it.").max(1000),
      kind: z.enum(["recipe", "template"]).default("template"),
      meal: z.enum(MEALS).nullish(),
      servings: z.coerce.number().positive().max(50).default(1),
      notes: z.string().max(500).default(""),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const foods = await foodsForUser(user.id);
  const items = interpret(parsed.data.text, foods);
  // A weak match is a different dish ("misal pav" is not Vada Pav), so it is
  // reported as skipped rather than quietly saved into the recipe.
  const confident = (i: (typeof items)[number]) => i.matched && Boolean(i.food) && (i.confidence ?? 0) >= AUTO_ACCEPT_CONFIDENCE;
  const matched = items.filter(confident);

  if (!matched.length) {
    return { error: "None of those ingredients were recognised. Try logging them on the Today tab first — anything new gets saved to your foods." };
  }

  const recipe = await prisma.recipe.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      meal: parsed.data.meal ?? null,
      servings: parsed.data.servings,
      notes: parsed.data.notes,
      items: {
        create: matched.map((item) => ({
          foodId: item.food!.id,
          // "2 large roti" keeps its size by storing 2.8 roti.
          quantity: Math.round(item.quantity * item.sizeFactor * 100) / 100,
          unit: item.nutrition!.unit,
        })),
      },
    },
  });

  revalidatePath("/recipes");
  revalidatePath("/today");
  const skipped = items.filter((i) => !confident(i)).map((i) => i.query);
  return { ok: true, id: recipe.id, skipped };
}

export async function deleteRecipeAction(id: string) {
  const user = await requireUser();
  await prisma.recipe.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/recipes");
  revalidatePath("/today");
  return { ok: true };
}

/** Log every ingredient of a recipe in one go. */
export async function logRecipeAction(input: { recipeId: string; meal: string; date: string; servings?: number }) {
  const user = await requireUser();
  if (!isDate(input.date) || !MEALS.includes(input.meal as never)) return { error: "Invalid meal or date." };
  const servings = input.servings ?? 1;
  if (!Number.isFinite(servings) || servings <= 0 || servings > 50) return { error: "Enter between 0.1 and 50 servings." };

  const detail = await recipeTotals(input.recipeId, user.id);
  if (!detail) return { error: "Recipe not found." };

  const portion = servings / (detail.recipe.servings || 1);
  const items = await prisma.recipeItem.findMany({ where: { recipeId: input.recipeId } });

  let kcal = 0;
  for (const item of items) {
    const food = await findFood(user.id, item.foodId);
    if (!food) continue;
    const quantity = item.quantity * portion;
    const nutrition = nutritionFor(food, quantity, item.unit);
    await createEntry(user.id, {
      date: input.date,
      meal: input.meal,
      rawText: `${detail.recipe.name} — ${food.name}`,
      food,
      quantity,
      nutrition,
      source: "recipe",
    });
    kcal += nutrition.kcal;
  }

  revalidatePath("/today");
  revalidatePath("/reports");
  return { ok: true, kcal: Math.round(kcal), name: detail.recipe.name };
}

/** Turn a day's meal into a reusable template — "save my usual breakfast". */
export async function saveMealAsTemplateAction(input: { date: string; meal: string; name: string }) {
  const user = await requireUser();
  if (!isDate(input.date) || !MEALS.includes(input.meal as never)) return { error: "Invalid meal or date." };

  const entries = await prisma.entry.findMany({
    where: { userId: user.id, date: input.date, meal: input.meal, foodId: { not: null } },
  });
  if (!entries.length) return { error: "Nothing logged in that meal yet." };

  const recipe = await prisma.recipe.create({
    data: {
      userId: user.id,
      name: input.name.trim().slice(0, 80) || `My ${input.meal}`,
      kind: "template",
      meal: input.meal,
      servings: 1,
      items: { create: entries.map((e) => ({ foodId: e.foodId!, quantity: e.quantity, unit: e.unit })) },
    },
  });

  revalidatePath("/recipes");
  revalidatePath("/today");
  return { ok: true, id: recipe.id };
}
