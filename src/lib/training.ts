import "server-only";
import { prisma } from "./db";
import { exercisesForUser, saveEstimatedExercise } from "./exercises";
import {
  AUTO_ACCEPT_CONFIDENCE, burnKcal, estimateOneRepMax, estimateStrengthMinutes,
  interpretWorkout, type ParsedExercise,
} from "./workout-parser";
import { estimateExercise, type AiConfig } from "./ai";
import { shiftDate, todayISO } from "./utils";

export type LogWorkoutResult = {
  workoutId: string | null;
  exercises: number;
  sets: number;
  kcal: number;
  durationMin: number;
  aiAdded: string[];
  failed: { phrase: string; reason: string }[];
};

/** Calories for one exercise's worth of sets. */
function kcalForSets(
  exercise: ParsedExercise,
  sets: { reps: number | null; durationMin: number | null }[],
  bodyWeightKg: number
) {
  const minutes = sets.reduce((total, set) => {
    if (set.durationMin) return total + set.durationMin;
    if (set.reps) return total + estimateStrengthMinutes(1, set.reps);
    return total;
  }, 0);
  return { minutes: Math.round(minutes * 10) / 10, kcal: burnKcal(exercise.met, minutes, bodyWeightKg) };
}

/**
 * The training equivalent of logging food: type a session, get exercises and
 * sets. Movements the library does not know go to the AI and are saved.
 */
export async function logWorkoutText(
  userId: string,
  text: string,
  date: string,
  options: { ai?: AiConfig | null; name?: string; notes?: string; rpe?: number | null } = {}
): Promise<LogWorkoutResult> {
  const [exercises, profile] = await Promise.all([
    exercisesForUser(userId),
    prisma.profile.findUnique({ where: { userId }, select: { weightKg: true } }),
  ]);
  const bodyWeight = profile?.weightKg ?? 70;

  const items = interpretWorkout(text, exercises);
  const aiAdded: string[] = [];
  const failed: LogWorkoutResult["failed"] = [];
  const resolved: { exercise: ParsedExercise; item: (typeof items)[number] }[] = [];

  for (const item of items) {
    if (item.matched && item.exercise && item.confidence >= AUTO_ACCEPT_CONFIDENCE) {
      resolved.push({ exercise: item.exercise, item });
      continue;
    }

    const nearest = item.matched ? item.exercise!.name : null;

    if (!options.ai) {
      failed.push({
        phrase: item.phrase,
        reason: nearest
          ? `Not sure that is "${nearest}" — search for it instead, or add an AI key in Settings.`
          : "Not in your exercise list, and no AI key is configured.",
      });
      continue;
    }

    try {
      const estimate = await estimateExercise(options.ai, item.query || item.phrase);
      if (!estimate?.name || estimate.confidence === "low") {
        if (item.matched && item.exercise) resolved.push({ exercise: item.exercise, item });
        else failed.push({ phrase: item.phrase, reason: `Could not work out what "${item.query}" is.` });
        continue;
      }
      const exercise = await saveEstimatedExercise(userId, estimate, item.query);
      aiAdded.push(exercise.name);
      resolved.push({ exercise, item });
    } catch (err) {
      failed.push({ phrase: item.phrase, reason: err instanceof Error ? err.message : "AI lookup failed." });
    }
  }

  if (!resolved.length) {
    return { workoutId: null, exercises: 0, sets: 0, kcal: 0, durationMin: 0, aiAdded, failed };
  }

  let totalKcal = 0;
  let totalMinutes = 0;
  let setCount = 0;
  const setRows: {
    exerciseId: string; position: number; setNumber: number; reps: number | null;
    weightKg: number | null; distanceKm: number | null; durationMin: number | null; kcal: number;
  }[] = [];

  resolved.forEach(({ exercise, item }, position) => {
    const { minutes, kcal } = kcalForSets(exercise, item.sets, bodyWeight);
    totalKcal += kcal;
    totalMinutes += minutes;

    for (const set of item.sets) {
      setCount++;
      setRows.push({
        exerciseId: exercise.id,
        position,
        setNumber: set.setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
        distanceKm: set.distanceKm,
        durationMin: set.durationMin,
        kcal: item.sets.length ? Math.round(kcal / item.sets.length) : 0,
      });
    }
  });

  const hasCardio = resolved.some((r) => r.exercise.isCardio);
  const hasStrength = resolved.some((r) => !r.exercise.isCardio);

  const workout = await prisma.workout.create({
    data: {
      userId,
      date,
      name: options.name?.trim() || defaultName(resolved.map((r) => r.exercise)),
      type: hasCardio && hasStrength ? "mixed" : hasCardio ? "cardio" : "strength",
      durationMin: Math.round(totalMinutes),
      kcal: Math.round(totalKcal),
      rpe: options.rpe ?? null,
      notes: options.notes?.slice(0, 500) ?? "",
      rawText: text.slice(0, 500),
      sets: { create: setRows },
    },
  });

  return {
    workoutId: workout.id,
    exercises: resolved.length,
    sets: setCount,
    kcal: Math.round(totalKcal),
    durationMin: Math.round(totalMinutes),
    aiAdded,
    failed,
  };
}

function defaultName(exercises: ParsedExercise[]) {
  const categories = [...new Set(exercises.map((e) => e.category))];
  if (categories.length === 1) {
    return { push: "Push day", pull: "Pull day", legs: "Leg day", core: "Core", cardio: "Cardio", mobility: "Mobility", full: "Full body" }[categories[0]] ?? "Training";
  }
  if (categories.includes("cardio") && categories.length === 2) return "Strength + cardio";
  return "Full body";
}

export type DayTraining = Awaited<ReturnType<typeof trainingForDay>>;

export async function trainingForDay(userId: string, date: string) {
  const workouts = await prisma.workout.findMany({
    where: { userId, date },
    orderBy: { startedAt: "asc" },
    include: { sets: { include: { exercise: { select: { id: true, name: true, category: true, isCardio: true } } }, orderBy: [{ position: "asc" }, { setNumber: "asc" }] } },
  });

  const kcal = workouts.reduce((sum, w) => sum + w.kcal, 0);
  const minutes = workouts.reduce((sum, w) => sum + w.durationMin, 0);

  return {
    date,
    workouts,
    kcal: Math.round(kcal),
    minutes,
    volumeKg: Math.round(
      workouts.reduce(
        (sum, w) => sum + w.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
        0
      )
    ),
  };
}

/** Personal bests per exercise, by estimated one-rep max. */
export async function personalRecords(userId: string, limit = 12) {
  const sets = await prisma.workoutSet.findMany({
    where: { workout: { userId }, weightKg: { not: null }, reps: { not: null }, isWarmup: false },
    include: { exercise: { select: { id: true, name: true } }, workout: { select: { date: true } } },
  });

  const best = new Map<string, { exerciseId: string; name: string; weightKg: number; reps: number; oneRm: number; date: string }>();
  for (const set of sets) {
    const oneRm = estimateOneRepMax(set.weightKg!, set.reps!);
    const current = best.get(set.exerciseId);
    if (!current || oneRm > current.oneRm) {
      best.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        name: set.exercise.name,
        weightKg: set.weightKg!,
        reps: set.reps!,
        oneRm,
        date: set.workout.date,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.oneRm - a.oneRm).slice(0, limit);
}

/** Weekly training summary used by reports and the AI coach. */
export async function trainingSummary(userId: string, days: number) {
  const from = shiftDate(todayISO(), -(days - 1));
  const workouts = await prisma.workout.findMany({
    where: { userId, date: { gte: from } },
    include: { sets: { include: { exercise: { select: { name: true, category: true, muscles: true, isCardio: true } } } } },
    orderBy: { date: "asc" },
  });

  const byCategory = new Map<string, { category: string; sets: number; kcal: number; minutes: number }>();
  const byExercise = new Map<string, { name: string; sets: number; volumeKg: number }>();
  let cardioMinutes = 0;
  let strengthSets = 0;
  let totalVolume = 0;

  for (const workout of workouts) {
    for (const set of workout.sets) {
      const category = set.exercise.category;
      const row = byCategory.get(category) ?? { category, sets: 0, kcal: 0, minutes: 0 };
      row.sets++;
      row.kcal += set.kcal;
      row.minutes += set.durationMin ?? 0;
      byCategory.set(category, row);

      const volume = (set.weightKg ?? 0) * (set.reps ?? 0);
      totalVolume += volume;
      if (set.exercise.isCardio) cardioMinutes += set.durationMin ?? 0;
      else strengthSets++;

      const ex = byExercise.get(set.exercise.name) ?? { name: set.exercise.name, sets: 0, volumeKg: 0 };
      ex.sets++;
      ex.volumeKg += volume;
      byExercise.set(set.exercise.name, ex);
    }
  }

  const daily = new Map<string, { date: string; kcal: number; minutes: number; volumeKg: number }>();
  for (const workout of workouts) {
    const row = daily.get(workout.date) ?? { date: workout.date, kcal: 0, minutes: 0, volumeKg: 0 };
    row.kcal += workout.kcal;
    row.minutes += workout.durationMin;
    row.volumeKg += workout.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
    daily.set(workout.date, row);
  }

  return {
    days,
    sessions: workouts.length,
    trainedDays: daily.size,
    kcal: Math.round(workouts.reduce((s, w) => s + w.kcal, 0)),
    minutes: workouts.reduce((s, w) => s + w.durationMin, 0),
    cardioMinutes: Math.round(cardioMinutes),
    strengthSets,
    volumeKg: Math.round(totalVolume),
    byCategory: [...byCategory.values()].sort((a, b) => b.sets - a.sets),
    topExercises: [...byExercise.values()].sort((a, b) => b.volumeKg - a.volumeKg).slice(0, 8),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    perWeek: Math.round((daily.size / days) * 7 * 10) / 10,
  };
}
