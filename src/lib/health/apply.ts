import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { refreshAdaptiveTdee } from "@/lib/adaptive";
import { sanitiseDay, type HealthBatch } from "./types";

/** Library exercise each synced activity is shown as, when there is a close one. */
const ACTIVITY_EXERCISE: Record<string, string> = {
  running: "Running", walking: "Walking", cycling: "Cycling", swimming: "Swimming",
  elliptical: "Elliptical", rowing: "Rowing Machine", stairs: "Stair Climber", hiit: "HIIT",
  yoga: "Yoga", pilates: "Pilates", football: "Football", cricket: "Cricket",
  badminton: "Badminton", basketball: "Basketball", boxing: "Boxing", skipping: "Skipping",
  stretching: "Stretching",
};

const ACTIVITY_LABEL: Record<string, string> = {
  strength: "Strength training", hiit: "HIIT", stairs: "Stair climbing", other: "Workout", dance: "Dance", tennis: "Tennis",
};

export type ApplyResult = { days: number; workouts: number; weighIns: number; summary: string };

/**
 * Write a normalised batch. Synced values overwrite what was typed in by hand
 * for the same day, because a watch counts steps better than memory does; a
 * field the batch does not mention is left alone.
 */
export async function applyHealthBatch(userId: string, batch: HealthBatch, method: "push" | "import"): Promise<ApplyResult> {
  const days = batch.days.map(sanitiseDay).filter((d): d is NonNullable<typeof d> => d !== null);
  const now = new Date();
  let weighIns = 0;

  for (const day of days) {
    const fields = {
      ...(day.steps !== undefined && { steps: day.steps }),
      ...(day.sleepHours !== undefined && { sleepHours: day.sleepHours }),
      ...(day.activeKcal !== undefined && { activeKcal: Math.round(day.activeKcal) }),
      ...(day.restingKcal !== undefined && { restingKcal: Math.round(day.restingKcal) }),
      ...(day.restingHr !== undefined && { restingHr: Math.round(day.restingHr) }),
      ...(day.distanceKm !== undefined && { distanceKm: Math.round(day.distanceKm * 100) / 100 }),
    };

    if (Object.keys(fields).length) {
      await prisma.dayLog.upsert({
        where: { userId_date: { userId, date: day.date } },
        create: { userId, date: day.date, ...fields, healthSource: batch.source, syncedAt: now },
        update: { ...fields, healthSource: batch.source, syncedAt: now },
      });
    }

    if (day.weightKg !== undefined) {
      await prisma.weightLog.upsert({
        where: { userId_date: { userId, date: day.date } },
        create: { userId, date: day.date, weightKg: Math.round(day.weightKg * 10) / 10 },
        update: { weightKg: Math.round(day.weightKg * 10) / 10 },
      });
      weighIns++;
    }

    if (day.bodyFatPct !== undefined) {
      await prisma.measurement.upsert({
        where: { userId_date: { userId, date: day.date } },
        create: { userId, date: day.date, bodyFatPct: Math.round(day.bodyFatPct * 10) / 10, notes: `From ${batch.source}` },
        update: { bodyFatPct: Math.round(day.bodyFatPct * 10) / 10 },
      });
    }
  }

  // Keep the profile on the latest weigh-in, as a manual weigh-in would.
  if (weighIns) {
    const latest = await prisma.weightLog.findFirst({ where: { userId }, orderBy: { date: "desc" } });
    if (latest) await prisma.profile.update({ where: { userId }, data: { weightKg: latest.weightKg } });
  }

  const exercises = await prisma.exercise.findMany({
    where: { userId: null, name: { in: Object.values(ACTIVITY_EXERCISE) } },
    select: { id: true, name: true },
  });
  const exerciseId = new Map(exercises.map((e) => [e.name, e.id]));

  let workouts = 0;
  for (const w of batch.workouts) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date) || !(w.durationMin > 0) || w.durationMin > 24 * 60) continue;

    // Namespaced and hashed so ids from different apps can never collide.
    const externalId = crypto.createHash("sha256").update(`${batch.source}|${w.externalId}`).digest("hex").slice(0, 32);
    const exists = await prisma.workout.findUnique({ where: { userId_externalId: { userId, externalId } }, select: { id: true } });
    if (exists) continue;

    const exerciseName = ACTIVITY_EXERCISE[w.activity];
    const id = exerciseName ? exerciseId.get(exerciseName) : undefined;
    const kcal = typeof w.kcal === "number" && w.kcal >= 0 && w.kcal < 5000 ? Math.round(w.kcal) : 0;

    await prisma.workout.create({
      data: {
        userId,
        date: w.date,
        name: exerciseName ?? ACTIVITY_LABEL[w.activity] ?? "Workout",
        type: w.activity === "strength" ? "strength" : ["yoga", "pilates", "stretching"].includes(w.activity) ? "class" : "cardio",
        startedAt: w.startedAt ?? new Date(`${w.date}T12:00:00`),
        durationMin: Math.round(w.durationMin),
        kcal,
        distanceKm: w.distanceKm ?? null,
        source: batch.source,
        externalId,
        rawText: `Synced from ${batch.source}`,
        ...(id && {
          sets: {
            create: [{ exerciseId: id, position: 0, setNumber: 1, durationMin: Math.round(w.durationMin * 10) / 10, distanceKm: w.distanceKm ?? null, kcal }],
          },
        }),
      },
    });
    workouts++;
  }

  const parts = [
    days.length && `${days.length} day${days.length === 1 ? "" : "s"}`,
    workouts && `${workouts} workout${workouts === 1 ? "" : "s"}`,
    weighIns && `${weighIns} weigh-in${weighIns === 1 ? "" : "s"}`,
  ].filter(Boolean);
  const summary = parts.length ? parts.join(", ") : "nothing new";

  await prisma.healthSync.create({
    data: { userId, source: batch.source, method, days: days.length, workouts, summary },
  });

  if (weighIns || days.some((d) => d.activeKcal !== undefined)) await refreshAdaptiveTdee(userId);

  return { days: days.length, workouts, weighIns, summary };
}

export async function recordFailedSync(userId: string, source: string, method: "push" | "import", error: string) {
  await prisma.healthSync.create({ data: { userId, source, method, error: error.slice(0, 300), summary: "failed" } });
}
