import "server-only";
import { prisma } from "./db";
import { estimateTdee, learnTdee } from "./nutrition";
import { shiftDate, todayISO } from "./utils";

/** Least-squares fit, so one odd weigh-in cannot swing the trend. */
function linearFit(points: { x: number; y: number }[]) {
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (!denominator) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, at: (x: number) => intercept + slope * x };
}

export type AdaptiveResult = {
  learnedTdee: number | null;
  formulaTdee: number;
  days: number;
  weighIns: number;
  loggedDays: number;
  avgIntake: number;
  trendKgPerWeek: number | null;
  reason?: string;
};

/**
 * Work out real maintenance from what actually happened:
 *   TDEE = average intake - (weight change in kcal / days)
 * Needs a reasonable window of both weigh-ins and food logs, otherwise the
 * formula estimate is the safer answer.
 */
export async function computeAdaptiveTdee(userId: string, windowDays = 28): Promise<AdaptiveResult> {
  const since = shiftDate(todayISO(), -windowDays);

  const [profile, weights, entries] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.weightLog.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.entry.findMany({ where: { userId, date: { gte: since } }, select: { date: true, kcal: true } }),
  ]);

  const formulaTdee = profile ? estimateTdee({ ...profile, adaptiveTdee: false }).formulaTdee : 0;

  const byDate = new Map<string, number>();
  for (const entry of entries) byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.kcal);

  const loggedDays = byDate.size;
  const avgIntake = loggedDays ? [...byDate.values()].reduce((a, b) => a + b, 0) / loggedDays : 0;

  const base = {
    learnedTdee: null,
    formulaTdee,
    days: windowDays,
    weighIns: weights.length,
    loggedDays,
    avgIntake: Math.round(avgIntake),
    trendKgPerWeek: null,
  } satisfies AdaptiveResult;

  if (weights.length < 4) return { ...base, reason: "Needs at least 4 weigh-ins in the last 4 weeks." };
  if (loggedDays < 10) return { ...base, reason: "Needs at least 10 days of food logged in the last 4 weeks." };

  const epoch = (d: string) => new Date(`${d}T12:00:00`).getTime() / 86400000;
  const first = epoch(weights[0].date);
  const fit = linearFit(weights.map((w) => ({ x: epoch(w.date) - first, y: w.weightKg })));
  if (!fit) return { ...base, reason: "Weigh-ins are all on the same day." };

  const spanDays = epoch(weights[weights.length - 1].date) - first;
  if (spanDays < 10) return { ...base, reason: "Weigh-ins need to span at least 10 days." };

  const trendKgPerWeek = Number((fit.slope * 7).toFixed(3));

  // Only the days that were actually logged can speak to intake, so scale the
  // observed weight change to that same number of days.
  const learned = learnTdee(
    {
      avgIntake,
      startWeight: fit.at(0),
      endWeight: fit.at(spanDays),
      days: spanDays,
    },
    formulaTdee
  );

  return {
    ...base,
    trendKgPerWeek,
    learnedTdee: learned,
    reason: learned
      ? undefined
      : "The numbers did not line up — usually missed logging days or an unusual few weeks. Keeping the formula estimate.",
  };
}

/** Recompute and store, so targets pick it up automatically. */
export async function refreshAdaptiveTdee(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { adaptiveTdee: true } });
  if (!profile?.adaptiveTdee) return null;

  const result = await computeAdaptiveTdee(userId);
  if (result.learnedTdee) {
    await prisma.profile.update({
      where: { userId },
      data: { learnedTdee: result.learnedTdee, learnedAt: new Date() },
    });
  }
  return result;
}
