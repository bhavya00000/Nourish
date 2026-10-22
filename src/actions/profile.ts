"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { calorieTarget } from "@/lib/nutrition";
import { refreshAdaptiveTdee } from "@/lib/adaptive";
import { todayISO } from "@/lib/tracker";

const profileSchema = z.object({
  age: z.coerce.number().int().min(12).max(100),
  sex: z.enum(["male", "female"]),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(25).max(400),
  jobRole: z.enum(["desk", "standing", "field", "labour"]),
  gymType: z.enum(["none", "weights", "cardio", "mixed", "yoga", "sports"]),
  gymDays: z.coerce.number().int().min(0).max(14),
  walkMinutes: z.coerce.number().int().min(0).max(360),
  dietType: z.enum(["veg", "eggetarian", "nonveg", "vegan"]),
  cuisines: z.string().max(200).default("indian"),
  allergies: z.string().max(300).default(""),
  dislikes: z.string().max(300).default(""),
  extraInfo: z.string().max(1000).default(""),
  eatingWindowH: z.coerce.number().int().min(4).max(24).default(12),
  useLoggedWorkouts: z.boolean().default(false),
});

const goalSchema = z.object({
  goalType: z.enum(["lose", "gain", "recomp", "maintain"]),
  targetWeight: z.coerce.number().min(25).max(400).nullish(),
  targetWeeks: z.coerce.number().int().min(2).max(104).default(24),
  customCalories: z.coerce.number().int().min(800).max(8000).nullish(),
});

export type SaveState = { error?: string; ok?: boolean } | undefined;

export async function saveOnboarding(input: unknown): Promise<SaveState> {
  const user = await requireUser();
  const parsed = z.object({ profile: profileSchema, goal: goalSchema }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { profile, goal } = parsed.data;
  await prisma.$transaction([
    prisma.profile.update({ where: { userId: user.id }, data: profile }),
    prisma.goal.update({
      where: { userId: user.id },
      data: {
        ...goal,
        targetWeight: goal.goalType === "maintain" ? null : goal.targetWeight ?? null,
        customCalories: goal.customCalories ?? null,
        startWeight: profile.weightKg,
        startDate: new Date(),
      },
    }),
    prisma.weightLog.upsert({
      where: { userId_date: { userId: user.id, date: todayISO() } },
      create: { userId: user.id, date: todayISO(), weightKg: profile.weightKg },
      update: { weightKg: profile.weightKg },
    }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function finishOnboarding() {
  redirect("/dashboard");
}

export async function updateProfile(input: unknown): Promise<SaveState> {
  const user = await requireUser();
  const parsed = profileSchema.partial().safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.profile.update({ where: { userId: user.id }, data: parsed.data });

  // A new weight here is also today's weigh-in, so the trend stays honest.
  if (parsed.data.weightKg) {
    await prisma.weightLog.upsert({
      where: { userId_date: { userId: user.id, date: todayISO() } },
      create: { userId: user.id, date: todayISO(), weightKg: parsed.data.weightKg },
      update: { weightKg: parsed.data.weightKg },
    });
    await refreshAdaptiveTdee(user.id);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateGoal(input: unknown): Promise<SaveState> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.goal.update({
    where: { userId: user.id },
    data: {
      ...parsed.data,
      targetWeight: parsed.data.goalType === "maintain" ? null : parsed.data.targetWeight ?? null,
      customCalories: parsed.data.customCalories ?? null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** What-if calculator: try numbers without saving them. */
export async function previewTargets(input: unknown) {
  const user = await requireUser();
  const [profile, goal] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);

  const parsed = z
    .object({ profile: profileSchema.partial().optional(), goal: goalSchema.partial().optional() })
    .safeParse(input);
  if (!parsed.success) return null;

  const merged = { ...profile, ...parsed.data.profile };
  if (!merged.weightKg || !merged.heightCm || !merged.age || !merged.sex) return null;

  return calorieTarget(merged, { ...goal, ...parsed.data.goal });
}

export async function setAdaptiveTdee(enabled: boolean) {
  const user = await requireUser();
  await prisma.profile.update({
    where: { userId: user.id },
    data: { adaptiveTdee: enabled, ...(enabled ? {} : { learnedTdee: null }) },
  });
  if (enabled) await refreshAdaptiveTdee(user.id);
  revalidatePath("/", "layout");
}

/** The product tour was finished or skipped, so it does not open again by itself. */
export async function markTourSeenAction() {
  const user = await requireUser();
  await prisma.profile.update({ where: { userId: user.id }, data: { tourSeenAt: new Date() } });
  return { ok: true };
}
