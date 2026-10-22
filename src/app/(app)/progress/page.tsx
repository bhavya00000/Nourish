import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weeklyReview } from "@/lib/insights";
import { syncAchievements } from "@/lib/achievements";
import { ProgressView } from "@/components/progress-view";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const [measurements, review, achievements, weights] = await Promise.all([
    prisma.measurement.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    weeklyReview(user.id),
    syncAchievements(user.id),
    prisma.weightLog.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, select: { date: true, weightKg: true } }),
  ]);

  return (
    <ProgressView
      measurements={JSON.parse(JSON.stringify(measurements))}
      insights={review.insights}
      insightsReady={review.enough}
      loggedDays={review.loggedDays}
      achievements={achievements.board}
      weights={weights}
    />
  );
}
