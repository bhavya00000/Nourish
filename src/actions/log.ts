"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { findFood } from "@/lib/foods";
import { nutritionFor } from "@/lib/parser";
import { createEntry, isDate, logText, todayISO } from "@/lib/tracker";
import { refreshAdaptiveTdee } from "@/lib/adaptive";
import { configFor } from "@/lib/ai-config";
import { MEALS } from "@/lib/nutrition";

const mealSchema = z.enum(MEALS);
const dateSchema = z.string().refine(isDate, "Invalid date");
// Quantity is expressed in whatever unit was chosen, so "200 g" is a quantity
// of 200. The ceiling only needs to rule out nonsense, not portion sizes.
const quantitySchema = z.coerce.number().positive("Enter a quantity above zero.").max(5000, "That quantity is too large.");

function refresh() {
  revalidatePath("/today");
  revalidatePath("/reports");
  revalidatePath("/coach");
}

export type LogTextResult = {
  added: number;
  kcal: number;
  aiAdded: string[];
  failed: { phrase: string; reason: string }[];
  error?: string;
};

/**
 * The main way food gets logged. Anything the database knows is logged
 * directly; anything it does not is estimated by AI, saved to the user's own
 * food list and logged — no form, no interruption.
 */
export async function logTextAction(input: {
  text: string;
  meal: string;
  date: string;
  useAi?: boolean;
}): Promise<LogTextResult> {
  const user = await requireUser();
  const parsed = z
    .object({ text: z.string().trim().min(1).max(400), meal: mealSchema, date: dateSchema, useAi: z.boolean().default(true) })
    .safeParse(input);

  if (!parsed.success) {
    return { added: 0, kcal: 0, aiAdded: [], failed: [], error: "Type what you ate, for example “2 roti and 1 katori dal”." };
  }

  const result = await logText(user.id, parsed.data.text, parsed.data.meal, parsed.data.date, {
    useAi: parsed.data.useAi,
    ai: parsed.data.useAi ? await configFor(user.id) : null,
  });
  refresh();

  return {
    added: result.added.length,
    kcal: Math.round(result.added.reduce((sum, e) => sum + e.kcal, 0)),
    aiAdded: result.aiAdded,
    failed: result.failed,
  };
}

export async function addEntryAction(input: { foodId: string; quantity: number; unit?: string; meal: string; date: string; rawText?: string }) {
  const user = await requireUser();
  const parsed = z
    .object({
      foodId: z.string().min(1),
      quantity: quantitySchema,
      unit: z.string().max(20).optional(),
      meal: mealSchema,
      date: dateSchema,
      rawText: z.string().max(200).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message || "Could not add that." };

  const food = await findFood(user.id, parsed.data.foodId);
  if (!food) return { error: "That food no longer exists." };

  const nutrition = nutritionFor(food, parsed.data.quantity, parsed.data.unit ?? null);
  await createEntry(user.id, {
    date: parsed.data.date,
    meal: parsed.data.meal,
    rawText: parsed.data.rawText ?? `${parsed.data.quantity} ${nutrition.unit} ${food.name}`,
    food,
    quantity: parsed.data.quantity,
    nutrition,
  });
  refresh();
  return { ok: true, kcal: nutrition.kcal, name: food.name };
}

export async function updateEntryAction(input: { id: string; quantity?: number; unit?: string; meal?: string }) {
  const user = await requireUser();
  const existing = await prisma.entry.findFirst({ where: { id: input.id, userId: user.id } });
  if (!existing) return { error: "Entry not found." };

  if (input.quantity !== undefined && !quantitySchema.safeParse(input.quantity).success) {
    return { error: "Enter a quantity between 0 and 5000." };
  }
  const meal = input.meal && MEALS.includes(input.meal as never) ? input.meal : existing.meal;
  const food = existing.foodId ? await findFood(user.id, existing.foodId) : null;

  const sameUnit = input.unit === undefined || input.unit === existing.unit;

  if (sameUnit && existing.quantity > 0) {
    // Scale what was logged rather than re-pricing it, which would drop a size
    // word ("1 large roti") and turn a moved meal into a different number.
    const ratio = (input.quantity ?? existing.quantity) / existing.quantity;
    const scale = (n: number) => Math.round(n * ratio * 10) / 10;
    await prisma.entry.update({
      where: { id: existing.id },
      data: {
        meal,
        quantity: existing.quantity * ratio,
        grams: scale(existing.grams),
        kcal: Math.round(existing.kcal * ratio),
        protein: scale(existing.protein),
        carbs: scale(existing.carbs),
        fat: scale(existing.fat),
        fiber: scale(existing.fiber),
        sugar: scale(existing.sugar),
        sodium: Math.round(existing.sodium * ratio),
      },
    });
  } else if (!food) {
    // The food behind this entry is gone, so a new unit cannot be priced.
    await prisma.entry.update({ where: { id: existing.id }, data: { meal } });
  } else {
    const quantity = input.quantity ?? existing.quantity;
    const nutrition = nutritionFor(food, quantity, input.unit ?? existing.unit);
    await prisma.entry.update({
      where: { id: existing.id },
      data: {
        meal,
        quantity,
        unit: nutrition.unit,
        grams: nutrition.grams,
        kcal: nutrition.kcal,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber,
        sugar: nutrition.sugar,
        sodium: nutrition.sodium,
      },
    });
  }
  refresh();
  return { ok: true };
}

export async function deleteEntryAction(id: string) {
  const user = await requireUser();
  const { count } = await prisma.entry.deleteMany({ where: { id, userId: user.id } });
  refresh();
  return count ? { ok: true } : { error: "Entry not found." };
}

export async function logWaterAction(date: string, ml: number) {
  const user = await requireUser();
  if (!isDate(date)) return { error: "Invalid date." };
  if (!Number.isFinite(ml) || Math.abs(ml) > 10000) return { error: "Enter an amount of water up to 10 litres." };

  const existing = await prisma.dayLog.findUnique({ where: { userId_date: { userId: user.id, date } } });
  const next = Math.round(Math.max(0, Math.min(10000, (existing?.waterMl ?? 0) + ml)));

  await prisma.dayLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, waterMl: next },
    update: { waterMl: next },
  });
  revalidatePath("/today");
  return { ok: true, waterMl: next };
}

export async function logWeightAction(date: string, weightKg: number) {
  const user = await requireUser();
  const parsed = z.object({ date: dateSchema, weightKg: z.coerce.number().min(25).max(400) }).safeParse({ date, weightKg });
  if (!parsed.success) return { error: "Enter a weight between 25 and 400 kg." };

  await prisma.weightLog.upsert({
    where: { userId_date: { userId: user.id, date: parsed.data.date } },
    create: { userId: user.id, date: parsed.data.date, weightKg: parsed.data.weightKg },
    update: { weightKg: parsed.data.weightKg },
  });

  // Keep the profile on the most recent weigh-in so targets track reality.
  const latest = await prisma.weightLog.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" } });
  if (latest) await prisma.profile.update({ where: { userId: user.id }, data: { weightKg: latest.weightKg } });

  const adaptive = await refreshAdaptiveTdee(user.id);
  revalidatePath("/", "layout");
  return { ok: true, learnedTdee: adaptive?.learnedTdee ?? null };
}

export async function copyDayAction(from: string, to: string, meal?: string) {
  const user = await requireUser();
  if (!isDate(from) || !isDate(to)) return { error: "Invalid dates." };

  const rows = await prisma.entry.findMany({
    where: { userId: user.id, date: from, ...(meal ? { meal } : {}) },
  });
  if (!rows.length) return { error: "Nothing logged on that day to copy." };

  await prisma.entry.createMany({
    data: rows.map((e) => ({
      userId: user.id, foodId: e.foodId, date: to, meal: e.meal, rawText: e.rawText, foodName: e.foodName,
      quantity: e.quantity, unit: e.unit, grams: e.grams, kcal: e.kcal, protein: e.protein, carbs: e.carbs,
      fat: e.fat, fiber: e.fiber, sugar: e.sugar, sodium: e.sodium, source: e.source,
    })),
  });
  refresh();
  return { ok: true, copied: rows.length };
}

export async function frequentFoods() {
  const user = await requireUser();
  const rows = await prisma.entry.groupBy({
    by: ["foodId", "foodName", "unit"],
    where: { userId: user.id, foodId: { not: null } },
    _count: { _all: true },
    _avg: { quantity: true },
    orderBy: { _count: { foodId: "desc" } },
    take: 10,
  });
  return rows
    .filter((r) => r.foodId)
    .map((r) => ({
      foodId: r.foodId!,
      name: r.foodName,
      unit: r.unit,
      quantity: Math.round((r._avg.quantity ?? 1) * 4) / 4,
      times: r._count._all,
    }));
}

export const today = todayISO;
