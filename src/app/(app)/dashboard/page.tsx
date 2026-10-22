import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { daySummary, todayISO } from "@/lib/tracker";
import { shiftDate } from "@/lib/utils";
import { loggingStreak } from "@/lib/reports";
import { weeklyReview } from "@/lib/insights";
import { syncAchievements } from "@/lib/achievements";
import { DashboardView } from "@/components/dashboard-view";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayISO();
  const weekAgo = shiftDate(todayISO(), -6);

  const [day, streak, review, achievements, weights, goal, week] = await Promise.all([
    daySummary(user.id, today),
    loggingStreak(user.id),
    weeklyReview(user.id),
    syncAchievements(user.id),
    prisma.weightLog.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, select: { date: true, weightKg: true } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
    prisma.entry.groupBy({
      by: ["date"],
      where: { userId: user.id, date: { gte: weekAgo } },
      _sum: { kcal: true, protein: true },
    }),
  ]);

  // Seven days ending today, gaps included, so a missed day reads as missed.
  const byDate = new Map(week.map((w) => [w.date, w._sum]));
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(todayISO(), -(6 - i));
    return { date, kcal: Math.round(byDate.get(date)?.kcal ?? 0), protein: Math.round(byDate.get(date)?.protein ?? 0) };
  });

  return (
    <DashboardView
      name={user.name}
      day={JSON.parse(JSON.stringify(day))}
      streak={streak}
      insights={review.insights}
      insightsReady={review.enough}
      achievements={achievements.board}
      newlyEarned={achievements.newlyEarned}
      weights={weights}
      goal={goal ? { goalType: goal.goalType, targetWeight: goal.targetWeight, startWeight: goal.startWeight } : null}
      last7={last7}
    />
  );
}
