import "server-only";
import { prisma } from "./db";
import { parseUnits, serialiseUnits, type ParsedFood } from "./parser";
import type { FoodEstimate } from "./ai";

type FoodRow = {
  id: string; name: string; aliases: string; kcal: number; protein: number; carbs: number;
  fat: number; fiber: number; sugar: number; sodium: number; units: string; veg: boolean;
  cuisine: string; tags: string; source: string;
};

const SELECT = {
  id: true, name: true, aliases: true, kcal: true, protein: true, carbs: true, fat: true,
  fiber: true, sugar: true, sodium: true, units: true, veg: true, cuisine: true, tags: true, source: true,
} as const;

export function toParsedFood(row: FoodRow): ParsedFood {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ? row.aliases.split("|").filter(Boolean) : [],
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    sugar: row.sugar,
    sodium: row.sodium,
    units: parseUnits(row.units),
    veg: row.veg,
    cuisine: row.cuisine,
    tags: row.tags ? row.tags.split("|").filter(Boolean) : [],
    source: row.source,
  };
}

// The built-in list only changes when the seed runs, so keep it in memory
// rather than reading 181 rows on every keystroke of a search.
let builtinCache: ParsedFood[] | null = null;

export async function builtinFoods() {
  if (!builtinCache) {
    const rows = await prisma.food.findMany({ where: { userId: null }, select: SELECT });
    builtinCache = rows.map(toParsedFood);
  }
  return builtinCache;
}

export const invalidateBuiltinCache = () => {
  builtinCache = null;
};

/** Built-in foods plus everything this user (or the AI, for them) has added. */
export async function foodsForUser(userId: string): Promise<ParsedFood[]> {
  const [builtin, own] = await Promise.all([
    builtinFoods(),
    prisma.food.findMany({ where: { userId }, select: SELECT }),
  ]);
  // User foods come first so their own version of a dish wins a tie.
  return [...own.map(toParsedFood), ...builtin];
}

export async function findFood(userId: string, foodId: string) {
  const row = await prisma.food.findFirst({
    where: { id: foodId, OR: [{ userId }, { userId: null }] },
    select: SELECT,
  });
  return row ? toParsedFood(row) : null;
}

export type NewFood = {
  name: string;
  aliases?: string[];
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  units: { name: string; grams: number }[];
  veg?: boolean;
  cuisine?: string;
  tags?: string[];
};

export async function saveFood(userId: string, food: NewFood, source = "custom") {
  const row = await prisma.food.create({
    data: {
      userId,
      name: food.name.trim().slice(0, 120),
      aliases: (food.aliases ?? []).join("|"),
      kcal: round(food.kcal),
      protein: round(food.protein ?? 0),
      carbs: round(food.carbs ?? 0),
      fat: round(food.fat ?? 0),
      fiber: round(food.fiber ?? 0),
      sugar: round(food.sugar ?? 0),
      sodium: round(food.sodium ?? 0),
      units: serialiseUnits(food.units.length ? food.units : [{ name: "g", grams: 1 }]),
      veg: food.veg ?? true,
      cuisine: food.cuisine ?? "other",
      tags: (food.tags ?? []).join("|"),
      source,
    },
    select: SELECT,
  });
  return toParsedFood(row);
}

/** Turn an AI estimate into a saved food belonging to this user. */
export async function saveEstimatedFood(userId: string, estimate: FoodEstimate, alias: string) {
  const unitName = (estimate.unit_name || "serving").trim();
  const unitGrams = Number(estimate.unit_grams) || 100;
  const units = [{ name: unitName, grams: unitGrams }];
  if (unitName !== "g") units.push({ name: "g", grams: 1 });

  return saveFood(
    userId,
    {
      name: estimate.name || alias,
      aliases: [alias],
      kcal: Number(estimate.kcal) || 0,
      protein: Number(estimate.protein) || 0,
      carbs: Number(estimate.carbs) || 0,
      fat: Number(estimate.fat) || 0,
      fiber: Number(estimate.fiber) || 0,
      sugar: Number(estimate.sugar) || 0,
      sodium: Number(estimate.sodium) || 0,
      units,
      veg: estimate.veg !== false,
      cuisine: estimate.cuisine || "other",
      tags: ["ai"],
    },
    "ai"
  );
}

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
