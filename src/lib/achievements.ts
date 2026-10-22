import "server-only";
import { prisma } from "./db";
import { loggingStreak } from "./reports";

/**
 * Feature: achievements. Deliberately about behaviour you control — logging,
 * consistency, showing up — rather than scale weight, which you do not.
 */
export type AchievementDef = {
  key: string;
  title: string;
  detail: string;
  icon: string;
  progress: (stats: Stats) => { value: number; target: number };
};

type Stats = {
  loggedDays: number;
  streak: number;
  workouts: number;
  weighIns: number;
  proteinDays: number;
  recipes: number;
  photoLogs: number;
  volumeKg: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first-day", title: "First day logged", detail: "Everything starts here.", icon: "🌱", progress: (s) => ({ value: s.loggedDays, target: 1 }) },
  { key: "week-streak", title: "Seven days running", detail: "A week without missing a day.", icon: "🔥", progress: (s) => ({ value: s.streak, target: 7 }) },
  { key: "month-streak", title: "Thirty days running", detail: "A month of consistency.", icon: "🏔️", progress: (s) => ({ value: s.streak, target: 30 }) },
  { key: "fifty-days", title: "Fifty days logged", detail: "Enough data to see real patterns.", icon: "📚", progress: (s) => ({ value: s.loggedDays, target: 50 }) },
  { key: "protein-10", title: "Protein, ten times", detail: "Hit your protein target on ten days.", icon: "🥚", progress: (s) => ({ value: s.proteinDays, target: 10 }) },
  { key: "first-workout", title: "First session", detail: "Logged a workout.", icon: "🏋️", progress: (s) => ({ value: s.workouts, target: 1 }) },
  { key: "ten-workouts", title: "Ten sessions", detail: "Showing up regularly.", icon: "💪", progress: (s) => ({ value: s.workouts, target: 10 }) },
  { key: "fifty-workouts", title: "Fifty sessions", detail: "This is a habit now.", icon: "🥇", progress: (s) => ({ value: s.workouts, target: 50 }) },
  { key: "tonne", title: "A tonne lifted", detail: "10,000 kg of total volume.", icon: "🗿", progress: (s) => ({ value: s.volumeKg, target: 10000 }) },
  { key: "ten-weighins", title: "Ten weigh-ins", detail: "Enough to trust the trend.", icon: "⚖️", progress: (s) => ({ value: s.weighIns, target: 10 }) },
  { key: "first-recipe", title: "First saved meal", detail: "Built a recipe or template.", icon: "🍲", progress: (s) => ({ value: s.recipes, target: 1 }) },
  { key: "photo-logger", title: "Snapped five meals", detail: "Logged five meals from a photo.", icon: "📷", progress: (s) => ({ value: s.photoLogs, target: 5 }) },
];

async function gatherStats(userId: string): Promise<Stats> {
  const [loggedDays, streak, workouts, weighIns, recipes, photoLogs, volume, targets] = await Promise.all([
    prisma.entry.findMany({ where: { userId }, select: { date: true }, distinct: ["date"] }).then((r) => r.length),
    loggingStreak(userId),
    prisma.workout.count({ where: { userId } }),
    prisma.weightLog.count({ where: { userId } }),
    prisma.recipe.count({ where: { userId } }),
    prisma.entry.count({ where: { userId, source: "vision" } }),
    prisma.workoutSet.findMany({ where: { workout: { userId } }, select: { weightKg: true, reps: true } }),
    import("./tracker").then((m) => m.targetsFor(userId)),
  ]);

  let proteinDays = 0;
  if (targets) {
    const rows = await prisma.entry.groupBy({ by: ["date"], where: { userId }, _sum: { protein: true } });
    proteinDays = rows.filter((r) => (r._sum.protein ?? 0) >= targets.macros.protein * 0.9).length;
  }

  return {
    loggedDays,
    streak,
    workouts,
    weighIns,
    recipes,
    photoLogs,
    proteinDays,
    volumeKg: Math.round(volume.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0)),
  };
}

/** Award anything newly earned and return the full board. */
export async function syncAchievements(userId: string) {
  const stats = await gatherStats(userId);
  const earned = await prisma.achievement.findMany({ where: { userId }, select: { key: true, earnedAt: true } });
  const earnedMap = new Map(earned.map((e) => [e.key, e.earnedAt]));

  const newlyEarned: AchievementDef[] = [];
  for (const definition of ACHIEVEMENTS) {
    const { value, target } = definition.progress(stats);
    if (value >= target && !earnedMap.has(definition.key)) {
      await prisma.achievement.create({ data: { userId, key: definition.key } }).catch(() => {});
      newlyEarned.push(definition);
    }
  }

  const refreshed = await prisma.achievement.findMany({ where: { userId }, select: { key: true, earnedAt: true } });
  const finalMap = new Map(refreshed.map((e) => [e.key, e.earnedAt]));

  return {
    newlyEarned: newlyEarned.map((d) => ({ key: d.key, title: d.title, icon: d.icon })),
    board: ACHIEVEMENTS.map((definition) => {
      const { value, target } = definition.progress(stats);
      return {
        key: definition.key,
        title: definition.title,
        detail: definition.detail,
        icon: definition.icon,
        earned: finalMap.has(definition.key),
        earnedAt: finalMap.get(definition.key)?.toISOString() ?? null,
        value: Math.min(value, target),
        target,
      };
    }).sort((a, b) => Number(b.earned) - Number(a.earned) || b.value / b.target - a.value / a.target),
    stats,
  };
}
