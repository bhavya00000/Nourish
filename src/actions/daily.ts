"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isDate } from "@/lib/tracker";
import { shiftDate, todayISO } from "@/lib/utils";
import { syncAchievements } from "@/lib/achievements";

const dateSchema = z.string().refine(isDate, "Invalid date");

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/progress");
}

// ---------------------------------------------------------------- steps + sleep

export async function logStepsAction(date: string, steps: number) {
  const user = await requireUser();
  const parsed = z.object({ date: dateSchema, steps: z.coerce.number().int().min(0).max(100000) }).safeParse({ date, steps });
  if (!parsed.success) return { error: "Enter a step count between 0 and 100,000." };

  await prisma.dayLog.upsert({
    where: { userId_date: { userId: user.id, date: parsed.data.date } },
    create: { userId: user.id, date: parsed.data.date, steps: parsed.data.steps },
    update: { steps: parsed.data.steps },
  });
  refresh();
  return { ok: true };
}

export async function logSleepAction(date: string, hours: number) {
  const user = await requireUser();
  const parsed = z.object({ date: dateSchema, hours: z.coerce.number().min(0).max(24) }).safeParse({ date, hours });
  if (!parsed.success) return { error: "Enter between 0 and 24 hours." };

  await prisma.dayLog.upsert({
    where: { userId_date: { userId: user.id, date: parsed.data.date } },
    create: { userId: user.id, date: parsed.data.date, sleepHours: parsed.data.hours },
    update: { sleepHours: parsed.data.hours },
  });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- measurements

const measurementSchema = z.object({
  date: dateSchema,
  waistCm: z.coerce.number().min(30).max(250).nullish(),
  chestCm: z.coerce.number().min(30).max(250).nullish(),
  hipsCm: z.coerce.number().min(30).max(250).nullish(),
  armCm: z.coerce.number().min(10).max(80).nullish(),
  thighCm: z.coerce.number().min(20).max(120).nullish(),
  bodyFatPct: z.coerce.number().min(2).max(70).nullish(),
  notes: z.string().max(300).default(""),
});

export async function saveMeasurementAction(input: unknown) {
  const user = await requireUser();
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { date, ...values } = parsed.data;
  const hasAny = [values.waistCm, values.chestCm, values.hipsCm, values.armCm, values.thighCm, values.bodyFatPct].some((v) => v != null);
  if (!hasAny) return { error: "Fill in at least one measurement." };

  const data = {
    waistCm: values.waistCm ?? null,
    chestCm: values.chestCm ?? null,
    hipsCm: values.hipsCm ?? null,
    armCm: values.armCm ?? null,
    thighCm: values.thighCm ?? null,
    bodyFatPct: values.bodyFatPct ?? null,
    notes: values.notes,
  };

  await prisma.measurement.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, ...data },
    update: data,
  });
  refresh();
  return { ok: true };
}

export async function deleteMeasurementAction(id: string) {
  const user = await requireUser();
  await prisma.measurement.deleteMany({ where: { id, userId: user.id } });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- achievements

export async function checkAchievementsAction() {
  const user = await requireUser();
  const result = await syncAchievements(user.id);
  return { newlyEarned: result.newlyEarned };
}

// ---------------------------------------------------------------- search

export type SearchHit = {
  kind: "food" | "workout";
  date: string;
  title: string;
  detail: string;
  kcal: number;
  href: string;
};

/** Feature: search everything you have ever logged — foods and training. */
export async function searchHistoryAction(input: { query: string; kind?: "all" | "food" | "workout"; days?: number }) {
  const user = await requireUser();
  const parsed = z
    .object({
      query: z.string().trim().max(80),
      kind: z.enum(["all", "food", "workout"]).default("all"),
      days: z.coerce.number().int().min(0).max(3650).default(0),
    })
    .safeParse(input);
  if (!parsed.success) return { hits: [] as SearchHit[], totals: null };

  const { query, kind, days } = parsed.data;
  const since = days ? shiftDate(todayISO(), -days) : undefined;
  const dateFilter = since ? { date: { gte: since } } : {};
  const hits: SearchHit[] = [];

  if (kind !== "workout") {
    const entries = await prisma.entry.findMany({
      where: {
        userId: user.id,
        ...dateFilter,
        ...(query ? { OR: [{ foodName: { contains: query } }, { rawText: { contains: query } }] } : {}),
      },
      orderBy: [{ date: "desc" }, { eatenAt: "desc" }],
      take: 200,
    });
    for (const e of entries) {
      hits.push({
        kind: "food",
        date: e.date,
        title: e.foodName,
        detail: `${Number(e.quantity) % 1 ? e.quantity.toFixed(2).replace(/0+$/, "") : e.quantity} ${e.unit} · ${e.meal} · P ${Math.round(e.protein)} g`,
        kcal: Math.round(e.kcal),
        href: `/today?date=${e.date}`,
      });
    }
  }

  if (kind !== "food") {
    const workouts = await prisma.workout.findMany({
      where: {
        userId: user.id,
        ...dateFilter,
        ...(query
          ? { OR: [{ name: { contains: query } }, { rawText: { contains: query } }, { sets: { some: { exercise: { name: { contains: query } } } } }] }
          : {}),
      },
      include: { sets: { include: { exercise: { select: { name: true } } } } },
      orderBy: { date: "desc" },
      take: 100,
    });
    for (const w of workouts) {
      const names = [...new Set(w.sets.map((s) => s.exercise.name))];
      hits.push({
        kind: "workout",
        date: w.date,
        title: w.name || "Training",
        detail: `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""} · ${w.durationMin} min`,
        kcal: Math.round(w.kcal),
        href: `/train?date=${w.date}`,
      });
    }
  }

  hits.sort((a, b) => b.date.localeCompare(a.date));

  const foodHits = hits.filter((h) => h.kind === "food");
  return {
    hits: hits.slice(0, 200),
    totals: {
      foodCount: foodHits.length,
      foodKcal: foodHits.reduce((sum, h) => sum + h.kcal, 0),
      workoutCount: hits.length - foodHits.length,
      days: new Set(hits.map((h) => h.date)).size,
    },
  };
}
