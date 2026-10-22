// Turns what people type at the gym ("bench 3x8 60kg", "running 20 min",
// "pushups 3x15") into exercises, sets and a calorie estimate.

import { normalise, scoreFood } from "./parser.ts";

export type ParsedExercise = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  muscles: string[];
  equipment: string;
  isCardio: boolean;
  met: number;
  source: string;
};

export type ParsedSet = {
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationMin: number | null;
  distanceKm: number | null;
};

const LB_TO_KG = 0.45359237;

/**
 * Split a line into individual exercise phrases. "and" is a separator, except
 * inside a name that legitimately contains it ("Clean and Press"), so those are
 * masked out first.
 */
export function splitExercises(text: string, protectedNames: string[] = []) {
  let working = String(text || "");
  const masks: string[] = [];

  for (const name of protectedNames) {
    const pattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    working = working.replace(pattern, () => {
      masks.push(name);
      return `\u0000${masks.length - 1}\u0000`;
    });
  }

  return working
    .split(/\s*(?:,|;|\n|\+|\band then\b|\bthen\b|\band\b|&)\s*/i)
    .map((part) => part.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[Number(i)]).trim())
    .filter(Boolean);
}

/**
 * Read the numbers out of one phrase. Handles:
 *   3x8, 3 x 8, 3*8            sets x reps
 *   60kg, @60, 135lb, bw       load
 *   20 min, 45s, 1h            duration
 *   5km, 3.1 miles             distance
 *   3x8 @60kg / 60x3x8         combined
 */
export function parseExercisePhrase(phrase: string) {
  let text = ` ${normalise(phrase)} `;

  let sets: number | null = null;
  let reps: number | null = null;
  let weightKg: number | null = null;
  let durationMin: number | null = null;
  let distanceKm: number | null = null;
  let bodyweight = false;

  // "3x60s" / "3x30 min" -- sets of a timed hold. Read this before the plain
  // duration patterns, which would otherwise swallow the "60s".
  let perSetMinutes: number | null = null;
  const timed = text.match(/(\d+)\s*[x*]\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|min)\b/);
  if (timed) {
    const value = Number(timed[2]);
    perSetMinutes = /^(s|sec)/.test(timed[3]) ? value / 60 : value;
    text = text.replace(timed[0], ` ${timed[1]}sets `);
  }

  const take = (pattern: RegExp, handler: (m: RegExpMatchArray) => void) => {
    const match = text.match(pattern);
    if (match) {
      handler(match);
      text = text.replace(match[0], " ");
    }
  };

  // Weight written with a unit, wherever it appears.
  take(/(\d+(?:\.\d+)?)\s*(kgs?|kilos?)\b/, (m) => { weightKg = Number(m[1]); });
  take(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?)\b/, (m) => { weightKg = Number(m[1]) * LB_TO_KG; });

  // Distance.
  take(/(\d+(?:\.\d+)?)\s*(kms?|kilometers?|kilometres?)\b/, (m) => { distanceKm = Number(m[1]); });
  take(/(\d+(?:\.\d+)?)\s*(miles?|mi)\b/, (m) => { distanceKm = Number(m[1]) * 1.60934; });
  take(/(\d+(?:\.\d+)?)\s*m\b(?!in)/, (m) => { distanceKm = Number(m[1]) / 1000; });

  // Duration.
  take(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/, (m) => { durationMin = (durationMin ?? 0) + Number(m[1]) * 60; });
  take(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|min)\b/, (m) => { durationMin = (durationMin ?? 0) + Number(m[1]); });
  take(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s)\b/, (m) => { durationMin = (durationMin ?? 0) + Number(m[1]) / 60; });

  // Sets x reps, optionally with the load attached.
  take(/(\d+)\s*[x*]\s*(\d+)\s*[x*]\s*(\d+(?:\.\d+)?)/, (m) => {
    sets = Number(m[1]);
    reps = Number(m[2]);
    if (weightKg === null) weightKg = Number(m[3]);
  });
  take(/(\d+)\s*[x*]\s*(\d+)/, (m) => {
    sets = Number(m[1]);
    reps = Number(m[2]);
  });

  // A load after an @, or a bare trailing number once sets/reps are known.
  take(/@\s*(\d+(?:\.\d+)?)/, (m) => { if (weightKg === null) weightKg = Number(m[1]); });
  if (weightKg === null && sets !== null) {
    take(/\s(\d+(?:\.\d+)?)\s*$/, (m) => { weightKg = Number(m[1]); });
  }

  take(/\b(bodyweight|bw)\b/, () => { bodyweight = true; });

  // "for 3 sets" / "8 reps" written out.
  take(/(\d+)\s*sets?\b/, (m) => { if (sets === null) sets = Number(m[1]); });
  take(/(\d+)\s*reps?\b/, (m) => { if (reps === null) reps = Number(m[1]); });

  if (perSetMinutes !== null) durationMin = (durationMin ?? 0) + perSetMinutes * (sets ?? 1);

  return {
    query: text.replace(/\s+/g, " ").trim(),
    sets,
    reps,
    perSetMinutes,
    weightKg: weightKg === null ? null : Math.round(weightKg * 10) / 10,
    durationMin: durationMin === null ? null : Math.round(durationMin * 10) / 10,
    distanceKm,
    bodyweight,
  };
}

/** Exercises reuse the food matcher — same scoring, same forgiveness of typos. */
export function searchExercises(query: string, exercises: ParsedExercise[], limit = 8) {
  return exercises
    .map((exercise) => ({
      exercise,
      score: scoreFood(query, {
        id: exercise.id,
        name: exercise.name,
        aliases: exercise.aliases,
        kcal: 0, protein: 0, carbs: 0, fat: 0,
        units: [], veg: true, cuisine: "", tags: [], source: exercise.source,
      }),
    }))
    .filter((r) => r.score > 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Same bar as food: below this we ask the AI rather than guess. */
export const AUTO_ACCEPT_CONFIDENCE = 0.75;

/**
 * Calories burnt. MET is kcal per kg of bodyweight per hour, which is the
 * standard way to estimate this and is honest about being an estimate.
 */
export function burnKcal(met: number, minutes: number, bodyWeightKg: number) {
  if (!minutes || !bodyWeightKg) return 0;
  return Math.round(met * bodyWeightKg * (minutes / 60));
}

/** A strength set takes roughly its working time plus rest. */
export function estimateStrengthMinutes(sets: number, reps: number) {
  const workSeconds = sets * reps * 3.5;
  const restSeconds = sets * 75;
  return Math.round(((workSeconds + restSeconds) / 60) * 10) / 10;
}

export type InterpretedExercise = {
  phrase: string;
  query: string;
  matched: boolean;
  confidence: number;
  exercise?: ParsedExercise;
  sets: ParsedSet[];
  durationMin: number;
  candidates: { id: string; name: string }[];
};

/** Full pipeline: one typed line to exercises with their sets. */
export function interpretWorkout(text: string, exercises: ParsedExercise[]): InterpretedExercise[] {
  const protectedNames = exercises
    .flatMap((e) => [e.name, ...e.aliases])
    .filter((name) => / and /i.test(name));

  return splitExercises(text, protectedNames).map((phrase) => {
    const parsed = parseExercisePhrase(phrase);
    const matches = searchExercises(parsed.query, exercises);
    const best = matches[0];

    const setCount = parsed.sets ?? 1;
    const cardio = best?.exercise.isCardio ?? (parsed.durationMin !== null && parsed.reps === null);

    const setRows: ParsedSet[] = Array.from({ length: cardio ? 1 : setCount }, (_, i) => ({
      setNumber: i + 1,
      reps: cardio ? null : parsed.reps,
      weightKg: cardio ? null : parsed.weightKg,
      durationMin: cardio ? parsed.durationMin : parsed.perSetMinutes,
      distanceKm: cardio ? parsed.distanceKm : null,
    }));

    const durationMin = cardio
      ? parsed.durationMin ?? 0
      : parsed.perSetMinutes !== null
        ? parsed.durationMin ?? 0
        : parsed.sets && parsed.reps
          ? estimateStrengthMinutes(parsed.sets, parsed.reps)
          : 0;

    return {
      phrase,
      query: parsed.query,
      matched: Boolean(best),
      confidence: best ? Number(best.score.toFixed(2)) : 0,
      exercise: best?.exercise,
      sets: setRows,
      durationMin,
      candidates: matches.slice(1, 5).map((m) => ({ id: m.exercise.id, name: m.exercise.name })),
    };
  });
}

/** Epley formula — the usual way to compare sets of different rep counts. */
export function estimateOneRepMax(weightKg: number, reps: number) {
  if (!weightKg || !reps) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
