"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { configFor } from "@/lib/ai-config";
import { logWorkoutText, personalRecords, trainingForDay, trainingSummary } from "@/lib/training";
import { exercisesForUser, findExercise, saveExercise } from "@/lib/exercises";
import { AUTO_ACCEPT_CONFIDENCE, burnKcal, estimateStrengthMinutes, interpretWorkout } from "@/lib/workout-parser";
import { suggestWorkout, trainingPlan, type TrainingPlan, type WorkoutAdvice } from "@/lib/ai";
import { isDate, loadProfileAndGoal, targetsFor, todayISO } from "@/lib/tracker";

const dateSchema = z.string().refine(isDate, "Invalid date");

function refresh() {
  revalidatePath("/train");
  revalidatePath("/today");
  revalidatePath("/reports");
  revalidatePath("/coach");
}

export async function logWorkoutAction(input: { text: string; date: string; name?: string; notes?: string; rpe?: number | null; useAi?: boolean }) {
  const user = await requireUser();
  const parsed = z
    .object({
      text: z.string().trim().min(1).max(1000),
      date: dateSchema,
      name: z.string().max(80).optional(),
      notes: z.string().max(500).optional(),
      rpe: z.coerce.number().int().min(1).max(10).nullish(),
      useAi: z.boolean().default(true),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { error: "Type what you did, for example “bench 3x8 60kg, running 20 min”." };
  }

  const result = await logWorkoutText(user.id, parsed.data.text, parsed.data.date, {
    ai: parsed.data.useAi ? await configFor(user.id) : null,
    name: parsed.data.name,
    notes: parsed.data.notes,
    rpe: parsed.data.rpe ?? null,
  });
  refresh();
  return result;
}

export async function deleteWorkoutAction(id: string) {
  const user = await requireUser();
  const { count } = await prisma.workout.deleteMany({ where: { id, userId: user.id } });
  refresh();
  return count ? { ok: true } : { error: "Workout not found." };
}

export async function updateSetAction(input: { id: string; reps?: number | null; weightKg?: number | null; durationMin?: number | null }) {
  const user = await requireUser();
  const set = await prisma.workoutSet.findFirst({
    where: { id: input.id, workout: { userId: user.id } },
    include: { exercise: true, workout: { select: { id: true } } },
  });
  if (!set) return { error: "Set not found." };

  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { weightKg: true } });
  const reps = input.reps ?? set.reps;
  const durationMin = input.durationMin ?? set.durationMin;
  const minutes = durationMin ?? (reps ? estimateStrengthMinutes(1, reps) : 0);

  await prisma.workoutSet.update({
    where: { id: set.id },
    data: {
      reps,
      weightKg: input.weightKg ?? set.weightKg,
      durationMin,
      kcal: burnKcal(set.exercise.met, minutes, profile?.weightKg ?? 70),
    },
  });

  // The session total is the sum of its sets, so recompute it.
  const sets = await prisma.workoutSet.findMany({ where: { workoutId: set.workout.id } });
  await prisma.workout.update({
    where: { id: set.workout.id },
    data: {
      kcal: Math.round(sets.reduce((sum, s) => sum + s.kcal, 0)),
      durationMin: Math.round(
        sets.reduce((sum, s) => sum + (s.durationMin ?? (s.reps ? estimateStrengthMinutes(1, s.reps) : 0)), 0)
      ),
    },
  });
  refresh();
  return { ok: true };
}

export async function deleteSetAction(id: string) {
  const user = await requireUser();
  const set = await prisma.workoutSet.findFirst({ where: { id, workout: { userId: user.id } }, select: { workoutId: true } });
  if (!set) return { error: "Set not found." };

  await prisma.workoutSet.delete({ where: { id } });
  const remaining = await prisma.workoutSet.findMany({ where: { workoutId: set.workoutId } });

  if (!remaining.length) {
    await prisma.workout.delete({ where: { id: set.workoutId } });
  } else {
    await prisma.workout.update({
      where: { id: set.workoutId },
      data: {
        kcal: Math.round(remaining.reduce((sum, s) => sum + s.kcal, 0)),
        durationMin: Math.round(
          remaining.reduce((sum, s) => sum + (s.durationMin ?? (s.reps ? estimateStrengthMinutes(1, s.reps) : 0)), 0)
        ),
      },
    });
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- routines

export async function listRoutines() {
  const user = await requireUser();
  const routines = await prisma.routine.findMany({
    where: { userId: user.id },
    include: { items: { include: { exercise: { select: { name: true, isCardio: true } } }, orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return routines.map((routine) => ({
    id: routine.id,
    name: routine.name,
    focus: routine.focus,
    notes: routine.notes,
    items: routine.items.map((item) => ({
      id: item.id,
      name: item.exercise.name,
      isCardio: item.exercise.isCardio,
      sets: item.sets,
      reps: item.reps,
      weightKg: item.weightKg,
      durationMin: item.durationMin,
    })),
  }));
}

export async function createRoutineAction(input: { name: string; text: string; focus?: string; notes?: string }) {
  const user = await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give it a name.").max(80),
      text: z.string().trim().min(1, "List the exercises.").max(1000),
      focus: z.string().max(30).default(""),
      notes: z.string().max(500).default(""),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const exercises = await exercisesForUser(user.id);
  const interpreted = interpretWorkout(parsed.data.text, exercises);
  // Same bar as logging: a look-alike is a different exercise, so it is skipped.
  const confident = (i: (typeof interpreted)[number]) => i.matched && Boolean(i.exercise) && i.confidence >= AUTO_ACCEPT_CONFIDENCE;
  const items = interpreted.filter(confident);
  if (!items.length) {
    return { error: "None of those exercises were recognised. Log them once on the Train tab first — anything new gets saved." };
  }

  const routine = await prisma.routine.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      focus: parsed.data.focus || items[0].exercise!.category,
      notes: parsed.data.notes,
      items: {
        create: items.map((item, position) => ({
          exerciseId: item.exercise!.id,
          position,
          sets: item.sets.length,
          reps: item.sets[0]?.reps ?? null,
          weightKg: item.sets[0]?.weightKg ?? null,
          durationMin: item.sets[0]?.durationMin ?? null,
        })),
      },
    },
  });

  revalidatePath("/train");
  return { ok: true, id: routine.id, skipped: interpreted.filter((i) => !confident(i)).map((i) => i.query) };
}

export async function deleteRoutineAction(id: string) {
  const user = await requireUser();
  await prisma.routine.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/train");
  return { ok: true };
}

/** Log a whole routine as today's session. */
export async function logRoutineAction(input: { routineId: string; date: string }) {
  const user = await requireUser();
  if (!isDate(input.date)) return { error: "Invalid date." };

  const routine = await prisma.routine.findFirst({
    where: { id: input.routineId, userId: user.id },
    include: { items: { include: { exercise: true }, orderBy: { position: "asc" } } },
  });
  if (!routine?.items.length) return { error: "Routine not found." };

  const text = routine.items
    .map((item) => {
      if (item.durationMin) return `${item.exercise.name} ${item.durationMin} min`;
      const load = item.weightKg ? ` @${item.weightKg}kg` : "";
      return `${item.exercise.name} ${item.sets}x${item.reps ?? 10}${load}`;
    })
    .join(", ");

  const result = await logWorkoutText(user.id, text, input.date, { ai: null, name: routine.name });
  refresh();
  return { ...result, name: routine.name };
}

// ---------------------------------------------------------------- data + AI

export async function trainingDay(date: string) {
  const user = await requireUser();
  return trainingForDay(user.id, isDate(date) ? date : todayISO());
}

export async function trainingStats(days = 30) {
  const user = await requireUser();
  const [summary, records] = await Promise.all([trainingSummary(user.id, days), personalRecords(user.id)]);
  return { summary, records };
}

export async function addExerciseAction(input: { name: string; category?: string; equipment?: string; isCardio?: boolean; met?: number }) {
  const user = await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      category: z.enum(["push", "pull", "legs", "core", "cardio", "mobility", "full"]).default("full"),
      equipment: z.string().max(40).default("bodyweight"),
      isCardio: z.boolean().default(false),
      met: z.coerce.number().min(1).max(20).default(5),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Check the exercise details." };

  const exercise = await saveExercise(user.id, parsed.data);
  revalidatePath("/train");
  return { ok: true, exercise };
}

export async function deleteExerciseAction(id: string) {
  const user = await requireUser();
  await prisma.exercise.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/train");
  return { ok: true };
}

export async function quickAddExerciseToday(input: { exerciseId: string; sets: number; reps: number; weightKg?: number | null; date: string }) {
  const user = await requireUser();
  const exercise = await findExercise(user.id, input.exerciseId);
  if (!exercise) return { error: "Exercise not found." };

  const load = input.weightKg ? ` @${input.weightKg}kg` : "";
  const text = exercise.isCardio ? `${exercise.name} ${input.reps} min` : `${exercise.name} ${input.sets}x${input.reps}${load}`;
  const result = await logWorkoutText(user.id, text, isDate(input.date) ? input.date : todayISO(), { ai: null });
  refresh();
  return result;
}

async function trainingContext(userId: string) {
  const [{ profile, goal }, targets, summary, records] = await Promise.all([
    loadProfileAndGoal(userId),
    targetsFor(userId),
    trainingSummary(userId, 14),
    personalRecords(userId, 8),
  ]);

  return {
    profile: {
      age: profile?.age, sex: profile?.sex, weight_kg: profile?.weightKg, height_cm: profile?.heightCm,
      job: profile?.jobRole, training_style: profile?.gymType, days_available: profile?.gymDays,
      walking_min_per_day: profile?.walkMinutes, notes: profile?.extraInfo,
    },
    goal: { type: goal?.goalType, target_weight: goal?.targetWeight, weeks: goal?.targetWeeks },
    calories: targets ? { target: targets.calories, maintenance: targets.tdee, protein_g: targets.macros.protein } : null,
    last_14_days: {
      sessions: summary.sessions,
      sessions_per_week: summary.perWeek,
      cardio_minutes: summary.cardioMinutes,
      strength_sets: summary.strengthSets,
      by_category: summary.byCategory,
      top_exercises: summary.topExercises,
    },
    personal_bests: records.map((r) => `${r.name}: ${r.weightKg} kg x ${r.reps} (est 1RM ${r.oneRm} kg)`),
  };
}

export async function trainingPlanAction(input: { preferences?: string; daysPerWeek?: number; equipment?: string }): Promise<{ plan?: TrainingPlan; error?: string }> {
  const user = await requireUser();
  const ai = await configFor(user.id);
  if (!ai) return { error: "No AI key is configured. Add yours in Settings." };

  try {
    return {
      plan: await trainingPlan(ai, {
        ...(await trainingContext(user.id)),
        days_per_week: input.daysPerWeek ?? null,
        equipment: input.equipment ?? null,
        preferences: input.preferences ?? null,
      }),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The plan failed." };
  }
}

export async function suggestWorkoutAction(input: { preferences?: string }): Promise<{ advice?: WorkoutAdvice; error?: string }> {
  const user = await requireUser();
  const ai = await configFor(user.id);
  if (!ai) return { error: "No AI key is configured. Add yours in Settings." };

  const today = todayISO();
  const [context, todayTraining] = await Promise.all([trainingContext(user.id), trainingForDay(user.id, today)]);
  const { daySummary } = await import("@/lib/tracker");
  const day = await daySummary(user.id, today);

  try {
    return {
      advice: await suggestWorkout(ai, {
        ...context,
        already_trained_today: todayTraining.workouts.map((w) => w.name),
        eaten_today_kcal: day.totals.kcal,
        remaining_today: day.remaining,
        preferences: input.preferences ?? null,
      }),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The suggestion failed." };
  }
}
