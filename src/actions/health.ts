"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createHealthToken } from "@/lib/health/tokens";

function refresh() {
  revalidatePath("/settings/health");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/train");
}

export async function createHealthTokenAction(label: string) {
  const user = await requireUser();
  const parsed = z.string().trim().min(1, "Give the token a name, e.g. “iPhone”.").max(40).safeParse(label);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const count = await prisma.healthToken.count({ where: { userId: user.id } });
  if (count >= 10) return { error: "You already have 10 tokens. Revoke one you no longer use first." };

  const created = await createHealthToken(user.id, parsed.data);
  revalidatePath("/settings/health");
  return { ok: true, token: created.token, id: created.id, prefix: created.prefix };
}

export async function revokeHealthTokenAction(id: string) {
  const user = await requireUser();
  await prisma.healthToken.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings/health");
  return { ok: true };
}

/**
 * Remove everything that came from a health app, without touching what the
 * user logged by hand (food, manual workouts, typed weigh-ins before syncing).
 */
export async function clearHealthDataAction() {
  const user = await requireUser();
  const [workouts, days] = await prisma.$transaction([
    prisma.workout.deleteMany({ where: { userId: user.id, NOT: { source: "manual" } } }),
    prisma.dayLog.updateMany({
      where: { userId: user.id, NOT: { healthSource: "" } },
      data: { activeKcal: null, restingKcal: null, restingHr: null, distanceKm: null, steps: 0, sleepHours: 0, healthSource: "", syncedAt: null },
    }),
    prisma.healthSync.deleteMany({ where: { userId: user.id } }),
  ]);
  refresh();
  return { ok: true, workouts: workouts.count, days: days.count };
}
