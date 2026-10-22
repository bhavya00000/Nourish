import "server-only";
import { prisma } from "./db";
import { calorieTarget, extraStepKcal, measuredActivityAdjustment, MEALS, type Targets } from "./nutrition";
import { trainingForDay } from "./training";
import { interpret, nutritionFor, type ParsedFood } from "./parser";
import { foodsForUser, saveEstimatedFood } from "./foods";
import { estimateFood, type AiConfig } from "./ai";
import { todayISO } from "./utils";

/**
 * How sure the matcher has to be before an entry is logged without asking.
 * Real foods in the database score 0.99-1.00; loose look-alikes ("misal pav"
 * against "Vada Pav") top out around 0.57, so anything below this goes to the
 * AI rather than being silently logged as the wrong dish.
 */
export const AUTO_ACCEPT_CONFIDENCE = 0.75;

// The server and the browser must agree on what "today" is, so both use local time.
export { todayISO } from "./utils";
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const round = (n: number) => Math.round(n * 10) / 10;

export async function loadProfileAndGoal(userId: string) {
  const [profile, goal] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.goal.findUnique({ where: { userId } }),
  ]);
  return { profile, goal };
}

/** Null until the profile has enough in it to compute anything. */
export async function targetsFor(userId: string): Promise<Targets | null> {
  const { profile, goal } = await loadProfileAndGoal(userId);
  if (!profile?.weightKg || !profile.heightCm || !profile.age || !profile.sex) return null;
  return calorieTarget(profile, goal);
}

export type DaySummary = Awaited<ReturnType<typeof daySummary>>;

export async function daySummary(userId: string, date: string) {
  const [entries, targets, day, training, profile] = await Promise.all([
    prisma.entry.findMany({ where: { userId, date }, orderBy: { eatenAt: "asc" } }),
    targetsFor(userId),
    prisma.dayLog.findUnique({ where: { userId_date: { userId, date } } }),
    trainingForDay(userId, date),
    prisma.profile.findUnique({ where: { userId }, select: { useLoggedWorkouts: true, weightKg: true, walkMinutes: true } }),
  ]);

  const blank = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, items: 0 });
  const totals = blank();
  const meals: Record<string, ReturnType<typeof blank> & { entries: typeof entries }> = {};
  for (const meal of MEALS) meals[meal] = { ...blank(), entries: [] };

  for (const entry of entries) {
    const bucket = (meals[entry.meal] ??= { ...blank(), entries: [] });
    for (const key of ["kcal", "protein", "carbs", "fat", "fiber"] as const) {
      bucket[key] += entry[key];
      totals[key] += entry[key];
    }
    bucket.items++;
    totals.items++;
    bucket.entries.push(entry);
  }
  for (const bucket of Object.values(meals)) {
    for (const key of ["kcal", "protein", "carbs", "fat", "fiber"] as const) bucket[key] = round(bucket[key]);
  }
  for (const key of ["kcal", "protein", "carbs", "fat", "fiber"] as const) totals[key] = round(totals[key]);

  const waterMl = day?.waterMl ?? 0;

  // With logged workouts turned on, what you burnt today is added to today's
  // budget — so rest days are leaner and training days give you more to eat.
  const steps = day?.steps ?? 0;
  const stepKcal = extraStepKcal(steps, profile?.weightKg ?? 70, profile?.walkMinutes ?? 0);
  const activeKcal = day?.activeKcal ?? null;

  // A watch measures what estimates only guess at, so when a day has measured
  // active energy it replaces the step and workout estimates rather than being
  // added to them — active energy already includes both.
  const energySource: "measured" | "estimated" = activeKcal !== null ? "measured" : "estimated";
  let earnedKcal = 0;
  if (profile?.useLoggedWorkouts && targets) {
    earnedKcal =
      activeKcal !== null
        ? measuredActivityAdjustment(activeKcal, targets, date < todayISO())
        : training.kcal + stepKcal;
  }
  const dayCalories = targets ? Math.max(targets.floor, targets.calories + earnedKcal) : 0;

  return {
    date,
    entries,
    meals,
    totals,
    targets,
    training,
    earnedKcal,
    energySource,
    stepKcal,
    steps,
    sleepHours: day?.sleepHours ?? 0,
    activeKcal,
    restingKcal: day?.restingKcal ?? null,
    restingHr: day?.restingHr ?? null,
    distanceKm: day?.distanceKm ?? null,
    healthSource: day?.healthSource ?? "",
    syncedAt: day?.syncedAt?.toISOString() ?? null,
    dayCalories,
    waterMl,
    window: eatingWindow(entries),
    remaining: targets
      ? {
          kcal: Math.round(dayCalories - totals.kcal),
          protein: round(targets.macros.protein - totals.protein),
          carbs: round(targets.macros.carbs - totals.carbs),
          fat: round(targets.macros.fat - totals.fat),
          waterMl: Math.max(0, targets.waterMl - waterMl),
        }
      : null,
  };
}

/** First meal to last meal — the eating window / fasting feature. */
export function eatingWindow(entries: { eatenAt: Date }[]) {
  if (!entries.length) return { first: null, last: null, hours: 0 };
  const times = entries.map((e) => new Date(e.eatenAt).getTime()).sort((a, b) => a - b);
  const first = new Date(times[0]);
  const last = new Date(times[times.length - 1]);
  return {
    first: first.toISOString(),
    last: last.toISOString(),
    hours: Number(((times[times.length - 1] - times[0]) / 3600000).toFixed(1)),
  };
}

export type LogResult = {
  added: Awaited<ReturnType<typeof prisma.entry.create>>[];
  aiAdded: string[];
  failed: { phrase: string; reason: string }[];
};

/**
 * The main logging path. Anything the database recognises is logged directly;
 * anything it does not is sent to the AI, saved as one of the user's own foods
 * and then logged — so the user never has to stop and fill in a form.
 */
export async function logText(
  userId: string,
  text: string,
  meal: string,
  date: string,
  { useAi = true, ai = null }: { useAi?: boolean; ai?: AiConfig | null } = {}
): Promise<LogResult> {
  const foods = await foodsForUser(userId);
  const items = interpret(text, foods);

  const added: LogResult["added"] = [];
  const aiAdded: string[] = [];
  const failed: LogResult["failed"] = [];

  for (const item of items) {
    const confident = item.matched && (item.confidence ?? 0) >= AUTO_ACCEPT_CONFIDENCE;

    if (confident && item.food && item.nutrition) {
      added.push(await createEntry(userId, { date, meal, rawText: item.phrase, food: item.food, quantity: item.quantity, nutrition: item.nutrition }));
      continue;
    }

    // A weak match is a hint, not an answer — name it if we have to give up.
    const nearest = item.matched ? item.food!.name : null;

    if (!useAi || !ai) {
      failed.push({
        phrase: item.phrase,
        reason: nearest
          ? `Not sure that is "${nearest}" — search for it instead, or turn on AI estimation.`
          : ai
            ? "Not in your food list."
            : "Not in your food list, and no AI key is configured.",
      });
      continue;
    }

    try {
      const estimate = await estimateFood(ai, item.query || item.phrase);
      if (!estimate?.kcal || estimate.confidence === "low") {
        // The AI could not place it either; fall back to the near match if any.
        if (item.matched && item.food && item.nutrition) {
          added.push(await createEntry(userId, { date, meal, rawText: item.phrase, food: item.food, quantity: item.quantity, nutrition: item.nutrition }));
        } else {
          failed.push({ phrase: item.phrase, reason: `Could not work out what "${item.query}" is.` });
        }
        continue;
      }
      const food = await saveEstimatedFood(userId, estimate, item.query);
      const nutrition = nutritionFor(food, item.quantity, item.unit, item.sizeFactor);
      added.push(await createEntry(userId, { date, meal, rawText: item.phrase, food, quantity: item.quantity, nutrition }));
      aiAdded.push(food.name);
    } catch (err) {
      failed.push({ phrase: item.phrase, reason: err instanceof Error ? err.message : "AI estimation failed." });
    }
  }

  return { added, aiAdded, failed };
}

export async function createEntry(
  userId: string,
  input: {
    date: string;
    meal: string;
    rawText: string;
    food: ParsedFood;
    quantity: number;
    nutrition: ReturnType<typeof nutritionFor>;
    source?: string;
  }
) {
  const { food, nutrition } = input;
  return prisma.entry.create({
    data: {
      userId,
      foodId: food.id,
      date: input.date,
      meal: input.meal,
      rawText: input.rawText.slice(0, 200),
      foodName: food.name,
      quantity: input.quantity,
      unit: nutrition.unit,
      grams: nutrition.grams,
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      fiber: nutrition.fiber,
      sugar: nutrition.sugar,
      sodium: nutrition.sodium,
      source: input.source ?? food.source,
    },
  });
}
