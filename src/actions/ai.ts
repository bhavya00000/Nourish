"use server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dayPlan, suggestMeal, weeklyInsight, type DayPlan, type Insight, type MealSuggestion } from "@/lib/ai";
import { aiAvailableFor, configFor } from "@/lib/ai-config";
import { daySummary, loadProfileAndGoal, targetsFor, todayISO } from "@/lib/tracker";
import { shiftDate } from "@/lib/utils";

const OFF = "No AI key is configured. Add yours in Settings — it takes a minute.";

async function userContext(userId: string) {
  const { profile, goal } = await loadProfileAndGoal(userId);
  return {
    profile: {
      age: profile?.age, sex: profile?.sex, height_cm: profile?.heightCm, weight_kg: profile?.weightKg,
      job: profile?.jobRole, training: `${profile?.gymType} x${profile?.gymDays}/week`,
      diet_type: profile?.dietType, cuisines: profile?.cuisines,
      allergies: profile?.allergies, dislikes: profile?.dislikes, notes: profile?.extraInfo,
    },
    goal: { type: goal?.goalType, target_weight: goal?.targetWeight, weeks: goal?.targetWeeks },
    targets: await targetsFor(userId),
  };
}

function nextMeal() {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 12) return "snacks";
  if (hour < 16) return "lunch";
  if (hour < 19) return "snacks";
  return "dinner";
}

export async function suggestMealAction(input: { meal?: string; preferences?: string }): Promise<{ suggestion?: MealSuggestion; error?: string }> {
  const user = await requireUser();
  const ai = await configFor(user.id);
  if (!ai) return { error: OFF };

  const day = await daySummary(user.id, todayISO());
  try {
    const suggestion = await suggestMeal(ai, {
      ...(await userContext(user.id)),
      meal: input.meal || nextMeal(),
      eaten_today: day.entries.map((e) => `${e.meal}: ${e.rawText || e.foodName} (${Math.round(e.kcal)} kcal)`),
      consumed: day.totals,
      remaining: day.remaining,
      preferences: input.preferences || null,
    });
    return { suggestion };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The suggestion failed." };
  }
}

export async function dayPlanAction(input: { preferences?: string }): Promise<{ plan?: DayPlan; error?: string }> {
  const user = await requireUser();
  const ai = await configFor(user.id);
  if (!ai) return { error: OFF };
  try {
    return { plan: await dayPlan(ai, { ...(await userContext(user.id)), preferences: input.preferences || null }) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The plan failed." };
  }
}

export async function insightAction(): Promise<{ insight?: Insight; error?: string }> {
  const user = await requireUser();
  const ai = await configFor(user.id);
  if (!ai) return { error: OFF };

  const since = shiftDate(todayISO(), -14);
  const entries = await prisma.entry.findMany({
    where: { userId: user.id, date: { gte: since } },
    select: { date: true, foodName: true, kcal: true, protein: true, carbs: true, fat: true },
  });
  if (!entries.length) return { error: "Log a few days of food first, then I can review it." };

  const byDate = new Map<string, { date: string; kcal: number; protein: number }>();
  for (const e of entries) {
    const row = byDate.get(e.date) ?? { date: e.date, kcal: 0, protein: 0 };
    row.kcal += e.kcal;
    row.protein += e.protein;
    byDate.set(e.date, row);
  }

  const { trainingSummary } = await import("@/lib/training");
  const training = await trainingSummary(user.id, 14);

  const weights = await prisma.weightLog.findMany({
    where: { userId: user.id, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true },
  });

  try {
    return {
      insight: await weeklyInsight(ai, {
        ...(await userContext(user.id)),
        days: 14,
        daily: [...byDate.values()].map((d) => ({ ...d, kcal: Math.round(d.kcal), protein: Math.round(d.protein) })),
        weights,
        training: {
          sessions: training.sessions,
          sessions_per_week: training.perWeek,
          kcal_burnt: training.kcal,
          cardio_minutes: training.cardioMinutes,
          strength_sets: training.strengthSets,
          by_category: training.byCategory,
        },
      }),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The review failed." };
  }
}

export async function aiStatus() {
  const user = await requireUser();
  return { available: await aiAvailableFor(user.id) };
}
