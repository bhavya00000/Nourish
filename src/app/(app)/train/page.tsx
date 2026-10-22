import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiAvailableFor } from "@/lib/ai-config";
import { isDate, todayISO } from "@/lib/tracker";
import { personalRecords, trainingForDay, trainingSummary } from "@/lib/training";
import { listRoutines } from "@/actions/training";
import { TrainView } from "@/components/train-view";

export const metadata = { title: "Train" };

export default async function TrainPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const date = isDate(params.date) ? params.date : todayISO();

  const [day, summary, records, routines, aiOn, profile] = await Promise.all([
    trainingForDay(user.id, date),
    trainingSummary(user.id, 30),
    personalRecords(user.id, 8),
    listRoutines(),
    aiAvailableFor(user.id),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { useLoggedWorkouts: true, weightKg: true } }),
  ]);

  return (
    <TrainView
      date={date}
      day={JSON.parse(JSON.stringify(day))}
      summary={summary}
      records={records}
      routines={routines}
      aiOn={aiOn}
      useLoggedWorkouts={profile?.useLoggedWorkouts ?? false}
    />
  );
}
