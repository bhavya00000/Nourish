import "server-only";
import { prisma } from "./db";
import type { ParsedExercise } from "./workout-parser";
import type { ExerciseEstimate } from "./ai";

const SELECT = {
  id: true, name: true, aliases: true, category: true, muscles: true,
  equipment: true, isCardio: true, met: true, source: true,
} as const;

type ExerciseRow = {
  id: string; name: string; aliases: string; category: string; muscles: string;
  equipment: string; isCardio: boolean; met: number; source: string;
};

export function toParsedExercise(row: ExerciseRow): ParsedExercise {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ? row.aliases.split("|").filter(Boolean) : [],
    category: row.category,
    muscles: row.muscles ? row.muscles.split("|").filter(Boolean) : [],
    equipment: row.equipment,
    isCardio: row.isCardio,
    met: row.met,
    source: row.source,
  };
}

// The built-in list only changes when the seed runs.
let builtinCache: ParsedExercise[] | null = null;

export async function builtinExercises() {
  if (!builtinCache) {
    const rows = await prisma.exercise.findMany({ where: { userId: null }, select: SELECT });
    builtinCache = rows.map(toParsedExercise);
  }
  return builtinCache;
}

export const invalidateExerciseCache = () => {
  builtinCache = null;
};

export async function exercisesForUser(userId: string): Promise<ParsedExercise[]> {
  const [builtin, own] = await Promise.all([
    builtinExercises(),
    prisma.exercise.findMany({ where: { userId }, select: SELECT }),
  ]);
  return [...own.map(toParsedExercise), ...builtin];
}

export async function findExercise(userId: string, id: string) {
  const row = await prisma.exercise.findFirst({
    where: { id, OR: [{ userId }, { userId: null }] },
    select: SELECT,
  });
  return row ? toParsedExercise(row) : null;
}

export async function saveExercise(
  userId: string,
  exercise: { name: string; aliases?: string[]; category?: string; muscles?: string[]; equipment?: string; isCardio?: boolean; met?: number },
  source = "custom"
) {
  const row = await prisma.exercise.create({
    data: {
      userId,
      name: exercise.name.trim().slice(0, 100),
      aliases: (exercise.aliases ?? []).join("|"),
      category: exercise.category ?? "full",
      muscles: (exercise.muscles ?? []).join("|"),
      equipment: exercise.equipment ?? "bodyweight",
      isCardio: exercise.isCardio ?? false,
      met: Math.min(20, Math.max(1, Number(exercise.met) || 5)),
      source,
    },
    select: SELECT,
  });
  return toParsedExercise(row);
}

export function saveEstimatedExercise(userId: string, estimate: ExerciseEstimate, alias: string) {
  return saveExercise(
    userId,
    {
      name: estimate.name || alias,
      aliases: [alias],
      category: estimate.category ?? "full",
      muscles: Array.isArray(estimate.muscles) ? estimate.muscles : [],
      equipment: estimate.equipment || "bodyweight",
      isCardio: Boolean(estimate.is_cardio),
      met: Number(estimate.met) || 5,
    },
    "ai"
  );
}
