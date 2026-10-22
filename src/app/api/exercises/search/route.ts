import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { exercisesForUser } from "@/lib/exercises";
import { parseExercisePhrase, searchExercises } from "@/lib/workout-parser";

/** Type-ahead for the workout box. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const exercises = await exercisesForUser(user.id);
  const { query: words, sets, reps, weightKg, durationMin } = parseExercisePhrase(query);

  const results = searchExercises(words || query, exercises, 8).map(({ exercise, score }) => ({
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    isCardio: exercise.isCardio,
    muscles: exercise.muscles,
    source: exercise.source,
    score: Number(score.toFixed(2)),
  }));

  return NextResponse.json({ results, parsed: { sets, reps, weightKg, durationMin } });
}
