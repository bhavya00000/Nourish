import "server-only";
import { prisma } from "./db";
import { trainingSummary } from "./training";
import { targetsFor } from "./tracker";
import { shiftDate, todayISO } from "./utils";

/**
 * Feature: automatic weekly review. Plain arithmetic over the log — no AI key
 * needed — so everyone gets something useful out of their data.
 */
export type Insight = { tone: "good" | "watch" | "info"; title: string; detail: string };

const round = (n: number) => Math.round(n * 10) / 10;

export async function weeklyReview(userId: string) {
  const from = shiftDate(todayISO(), -27);

  const [entries, weights, targets, training] = await Promise.all([
    prisma.entry.findMany({
      where: { userId, date: { gte: from } },
      select: { date: true, kcal: true, protein: true, meal: true, eatenAt: true, foodName: true },
    }),
    prisma.weightLog.findMany({ where: { userId, date: { gte: from } }, orderBy: { date: "asc" } }),
    targetsFor(userId),
    trainingSummary(userId, 28),
  ]);

  const byDate = new Map<string, { kcal: number; protein: number; weekend: boolean }>();
  for (const entry of entries) {
    const row = byDate.get(entry.date) ?? {
      kcal: 0,
      protein: 0,
      weekend: [0, 6].includes(new Date(`${entry.date}T12:00:00`).getDay()),
    };
    row.kcal += entry.kcal;
    row.protein += entry.protein;
    byDate.set(entry.date, row);
  }

  const days = [...byDate.values()];
  const insights: Insight[] = [];
  if (days.length < 4) return { insights, loggedDays: days.length, enough: false };

  const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

  // Weekend drift is the single most common reason a deficit stalls.
  const weekdays = days.filter((d) => !d.weekend).map((d) => d.kcal);
  const weekends = days.filter((d) => d.weekend).map((d) => d.kcal);
  if (weekdays.length >= 3 && weekends.length >= 2) {
    const gap = Math.round(mean(weekends) - mean(weekdays));
    if (Math.abs(gap) >= 250) {
      insights.push({
        tone: gap > 0 ? "watch" : "info",
        title: gap > 0 ? `Weekends run ${gap} kcal higher` : `Weekends run ${Math.abs(gap)} kcal lower`,
        detail:
          gap > 0
            ? `You average ${Math.round(mean(weekdays))} kcal on weekdays and ${Math.round(mean(weekends))} at weekends. Two big weekend days can cancel five good weekdays.`
            : `You average ${Math.round(mean(weekends))} kcal at weekends against ${Math.round(mean(weekdays))} on weekdays — the deficit is being done mostly on Saturday and Sunday.`,
      });
    }
  }

  // Protein is the macro that actually protects muscle in a deficit.
  if (targets) {
    const hit = days.filter((d) => d.protein >= targets.macros.protein * 0.9).length;
    const rate = Math.round((hit / days.length) * 100);
    insights.push({
      tone: rate >= 70 ? "good" : "watch",
      title: `Protein target hit on ${rate}% of logged days`,
      detail:
        rate >= 70
          ? `${hit} of ${days.length} days at or near ${Math.round(targets.macros.protein)} g. That is the habit that keeps weight loss coming off fat rather than muscle.`
          : `Only ${hit} of ${days.length} days reached ${Math.round(targets.macros.protein)} g. Adding one protein-led item to breakfast is usually the easiest fix.`,
    });
  }

  // Consistency of logging beats precision of logging.
  const coverage = Math.round((days.length / 28) * 100);
  insights.push({
    tone: coverage >= 70 ? "good" : "info",
    title: `Logged ${days.length} of the last 28 days`,
    detail:
      coverage >= 70
        ? "Enough coverage for the averages and the adaptive maintenance figure to be trustworthy."
        : "Averages get much more useful past about 20 days a month — the gaps are where estimates drift.",
  });

  // Eating late is worth surfacing when it is a pattern, not a one-off.
  const lateDays = new Set(
    entries.filter((e) => new Date(e.eatenAt).getHours() >= 22).map((e) => e.date)
  );
  if (lateDays.size >= 3) {
    insights.push({
      tone: "watch",
      title: `Eating after 10pm on ${lateDays.size} days`,
      detail: "Late meals are not fattening by themselves, but they often mean the day's plan slipped. Worth a look at whether dinner is big enough.",
    });
  }

  // Do training days actually get fed?
  if (training.trainedDays >= 3) {
    const trainedDates = new Set(training.daily.map((d) => d.date));
    const trained = days.filter((_, i) => trainedDates.has([...byDate.keys()][i])).map((d) => d.kcal);
    const rest = days.filter((_, i) => !trainedDates.has([...byDate.keys()][i])).map((d) => d.kcal);
    if (trained.length >= 2 && rest.length >= 2) {
      const gap = Math.round(mean(trained) - mean(rest));
      insights.push({
        tone: gap < -150 ? "watch" : "info",
        title: gap >= 0 ? `You eat ${gap} kcal more on training days` : `You eat ${Math.abs(gap)} kcal less on training days`,
        detail:
          gap < -150
            ? "Under-eating on the days you train tends to cost you session quality and recovery. Consider shifting some calories onto training days."
            : "Eating a little more around training is usually the right way round.",
      });
    }
  }

  // Where the calories actually come from.
  const mealTotals = new Map<string, number>();
  for (const entry of entries) mealTotals.set(entry.meal, (mealTotals.get(entry.meal) ?? 0) + entry.kcal);
  const total = [...mealTotals.values()].reduce((a, b) => a + b, 0) || 1;
  const snacks = (mealTotals.get("snacks") ?? 0) + (mealTotals.get("event") ?? 0);
  const snackShare = Math.round((snacks / total) * 100);
  if (snackShare >= 30) {
    insights.push({
      tone: "watch",
      title: `${snackShare}% of your calories come from snacks and eating out`,
      detail: "Meals you plan are much easier to control than the ones you do not. Making lunch or dinner larger usually shrinks this on its own.",
    });
  }

  if (weights.length >= 4) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    const change = round(last.weightKg - first.weightKg);
    const spanDays = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000 || 1;
    const perWeek = round((change / spanDays) * 7);
    insights.push({
      tone: "info",
      title: `${change > 0 ? "+" : ""}${change} kg over ${Math.round(spanDays)} days`,
      detail: `That is ${perWeek > 0 ? "+" : ""}${perWeek} kg per week measured. Day-to-day weight moves with water and food volume, so the trend is the number that matters.`,
    });
  }

  return { insights, loggedDays: days.length, enough: true };
}
