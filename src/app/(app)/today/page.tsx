import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { daySummary, isDate, todayISO } from "@/lib/tracker";
import { aiAvailableFor } from "@/lib/ai-config";
import { frequentFoods } from "@/actions/log";
import { DayView } from "@/components/day-view";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const date = isDate(params.date) ? params.date : todayISO();

  const [day, frequent, recipes, aiOn] = await Promise.all([
    daySummary(user.id, date),
    frequentFoods(),
    prisma.recipe.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, kind: true, meal: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    aiAvailableFor(user.id),
  ]);

  return <DayView day={day} frequent={frequent} recipes={recipes} aiOn={aiOn} />;
}
