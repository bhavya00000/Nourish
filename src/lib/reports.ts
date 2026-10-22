import "server-only";
import { prisma } from "./db";
import { targetsFor } from "./tracker";
import { computeAdaptiveTdee } from "./adaptive";
import { trainingSummary } from "./training";
import { KCAL_PER_KG } from "./nutrition";
import { localISO } from "./utils";

const isoDay = localISO;
const round = (n: number) => Math.round(n * 10) / 10;

/** Consecutive days up to today with at least one entry. */
export async function loggingStreak(userId: string) {
  const rows = await prisma.entry.findMany({
    where: { userId },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: 400,
  });
  const logged = new Set(rows.map((r) => r.date));

  let streak = 0;
  const cursor = new Date();
  // Today not being logged yet should not break yesterday's streak.
  if (!logged.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (logged.has(isoDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function reportSummary(userId: string, days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const from = isoDay(start);
  const to = isoDay(end);

  const [entries, weightsAll, targets, adaptive, streak, training] = await Promise.all([
    prisma.entry.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: { date: true, meal: true, foodName: true, kcal: true, protein: true, carbs: true, fat: true, eatenAt: true },
    }),
    prisma.weightLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    targetsFor(userId),
    computeAdaptiveTdee(userId),
    loggingStreak(userId),
    trainingSummary(userId, days),
  ]);

  // Daily rollup, with gaps filled so missed days show as gaps rather than vanish.
  const byDate = new Map<string, { date: string; kcal: number; protein: number; carbs: number; fat: number; items: number }>();
  for (const e of entries) {
    const row = byDate.get(e.date) ?? { date: e.date, kcal: 0, protein: 0, carbs: 0, fat: 0, items: 0 };
    row.kcal += e.kcal;
    row.protein += e.protein;
    row.carbs += e.carbs;
    row.fat += e.fat;
    row.items++;
    byDate.set(e.date, row);
  }

  const series: { date: string; kcal: number; protein: number; carbs: number; fat: number; items: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = isoDay(d);
    const row = byDate.get(key);
    series.push(
      row
        ? { ...row, kcal: Math.round(row.kcal), protein: round(row.protein), carbs: round(row.carbs), fat: round(row.fat) }
        : { date: key, kcal: 0, protein: 0, carbs: 0, fat: 0, items: 0 }
    );
  }

  const loggedDays = byDate.size;
  const logged = [...byDate.values()];
  const averages = loggedDays
    ? {
        kcal: Math.round(logged.reduce((a, d) => a + d.kcal, 0) / loggedDays),
        protein: round(logged.reduce((a, d) => a + d.protein, 0) / loggedDays),
        carbs: round(logged.reduce((a, d) => a + d.carbs, 0) / loggedDays),
        fat: round(logged.reduce((a, d) => a + d.fat, 0) / loggedDays),
      }
    : { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  // "On target" means within 10% of the goal on a day that was actually logged.
  let onTarget = 0;
  let under = 0;
  let over = 0;
  if (targets) {
    for (const d of logged) {
      const diff = d.kcal - targets.calories;
      if (Math.abs(diff) <= targets.calories * 0.1) onTarget++;
      else if (diff < 0) under++;
      else over++;
    }
  }

  const mealTotals = new Map<string, { meal: string; kcal: number; items: number }>();
  for (const e of entries) {
    const row = mealTotals.get(e.meal) ?? { meal: e.meal, kcal: 0, items: 0 };
    row.kcal += e.kcal;
    row.items++;
    mealTotals.set(e.meal, row);
  }

  const foodTotals = new Map<string, { name: string; kcal: number; times: number }>();
  for (const e of entries) {
    const row = foodTotals.get(e.foodName) ?? { name: e.foodName, kcal: 0, times: 0 };
    row.kcal += e.kcal;
    row.times++;
    foodTotals.set(e.foodName, row);
  }

  // Average eating window across the days that have at least two entries.
  const windowByDate = new Map<string, number[]>();
  for (const e of entries) {
    const list = windowByDate.get(e.date) ?? [];
    list.push(new Date(e.eatenAt).getTime());
    windowByDate.set(e.date, list);
  }
  const windows = [...windowByDate.values()]
    .filter((times) => times.length > 1)
    .map((times) => (Math.max(...times) - Math.min(...times)) / 3600000);
  const avgWindow = windows.length ? round(windows.reduce((a, b) => a + b, 0) / windows.length) : null;

  let actualKgPerWeek: number | null = null;
  if (weightsAll.length >= 2) {
    const first = weightsAll[0];
    const last = weightsAll[weightsAll.length - 1];
    const spanDays = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000;
    if (spanDays >= 3) actualKgPerWeek = round(((last.weightKg - first.weightKg) / spanDays) * 7);
  }

  const energyBalance =
    targets && loggedDays
      ? {
          avgIntake: averages.kcal,
          tdee: targets.tdee,
          dailyBalance: Math.round(averages.kcal - targets.tdee),
          plannedDailyBalance: targets.dailyDelta,
          projectedKgPerWeek: round(((averages.kcal - targets.tdee) * 7) / KCAL_PER_KG),
        }
      : null;

  return {
    range: { from, to, days },
    series,
    averages,
    loggedDays,
    adherence: { onTarget, under, over, logged: loggedDays, missed: days - loggedDays },
    byMeal: [...mealTotals.values()].map((m) => ({ ...m, kcal: Math.round(m.kcal) })).sort((a, b) => b.kcal - a.kcal),
    topFoods: [...foodTotals.values()].map((f) => ({ ...f, kcal: Math.round(f.kcal) })).sort((a, b) => b.kcal - a.kcal).slice(0, 8),
    weights: weightsAll.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    actualKgPerWeek,
    avgWindow,
    energyBalance,
    training,
    adaptive,
    streak,
    targets,
  };
}
