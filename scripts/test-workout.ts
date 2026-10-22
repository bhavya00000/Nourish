// Regression test for the workout parser. Run: npm run test:workout
import { interpretWorkout, burnKcal, estimateOneRepMax, type ParsedExercise } from "../src/lib/workout-parser.ts";
import { SEED_EXERCISES } from "../src/lib/exercises-seed.ts";

const EXERCISES: ParsedExercise[] = SEED_EXERCISES.map((e, i) => ({
  id: String(i), name: e.name, aliases: e.aliases, category: e.category,
  muscles: e.muscles, equipment: e.equipment, isCardio: e.isCardio, met: e.met, source: "builtin",
}));

type Case = { input: string; want: { name: string; sets?: number; reps?: number | null; weightKg?: number | null; durationMin?: number | null }[] };

const CASES: Case[] = [
  { input: "bench 3x8 60kg", want: [{ name: "Barbell Bench Press", sets: 3, reps: 8, weightKg: 60 }] },
  { input: "bench press 4x6 @70", want: [{ name: "Barbell Bench Press", sets: 4, reps: 6, weightKg: 70 }] },
  { input: "squats 5x5 80kg", want: [{ name: "Barbell Back Squat", sets: 5, reps: 5, weightKg: 80 }] },
  { input: "deadlift 3x5 100kg", want: [{ name: "Deadlift", sets: 3, reps: 5, weightKg: 100 }] },
  { input: "pushups 3x15", want: [{ name: "Push-Up", sets: 3, reps: 15, weightKg: null }] },
  { input: "pull ups 4x8", want: [{ name: "Pull-Up", sets: 4, reps: 8 }] },
  { input: "lat pulldown 3x12 45kg", want: [{ name: "Lat Pulldown", sets: 3, reps: 12, weightKg: 45 }] },
  { input: "running 20 min", want: [{ name: "Running", durationMin: 20 }] },
  { input: "cycling 45 mins", want: [{ name: "Cycling", durationMin: 45 }] },
  { input: "treadmill walk 30 min", want: [{ name: "Treadmill Walking", durationMin: 30 }] },
  { input: "plank 3x60s", want: [{ name: "Plank", sets: 3 }] },
  { input: "bicep curl 3x12 15kg", want: [{ name: "Dumbbell Curl", sets: 3, reps: 12, weightKg: 15 }] },
  { input: "ohp 3x8 40kg", want: [{ name: "Overhead Press", sets: 3, reps: 8, weightKg: 40 }] },
  { input: "bench 3x8 135lb", want: [{ name: "Barbell Bench Press", sets: 3, reps: 8, weightKg: 61.2 }] },
  {
    input: "bench 3x8 60kg, barbell row 3x10 50kg, running 15 min",
    want: [
      { name: "Barbell Bench Press", sets: 3, reps: 8, weightKg: 60 },
      { name: "Barbell Row", sets: 3, reps: 10, weightKg: 50 },
      { name: "Running", durationMin: 15 },
    ],
  },
  { input: "clean and press 3x5 50kg", want: [{ name: "Clean and Press", sets: 3, reps: 5, weightKg: 50 }] },
  {
    input: "clean and press 3x5 50kg and running 10 min",
    want: [{ name: "Clean and Press", sets: 3, reps: 5, weightKg: 50 }, { name: "Running", durationMin: 10 }],
  },
  { input: "plank 3x60s", want: [{ name: "Plank", sets: 3 }] },
  { input: "leg press 4x12 120kg and lunges 3x10", want: [{ name: "Leg Press", sets: 4, reps: 12, weightKg: 120 }, { name: "Lunge", sets: 3, reps: 10 }] },
];

let passed = 0;
const failures: string[] = [];

for (const testCase of CASES) {
  const got = interpretWorkout(testCase.input, EXERCISES);
  const problems: string[] = [];

  if (got.length !== testCase.want.length) problems.push(`expected ${testCase.want.length} exercises, got ${got.length}`);

  testCase.want.forEach((want, i) => {
    const item = got[i];
    if (!item?.matched) return problems.push(`[${i}] no match for "${item?.query ?? "?"}"`);
    if (item.exercise!.name !== want.name) problems.push(`[${i}] matched "${item.exercise!.name}", wanted "${want.name}"`);
    if (want.sets !== undefined && item.sets.length !== want.sets) problems.push(`[${i}] ${item.sets.length} sets, wanted ${want.sets}`);
    if (want.reps !== undefined && item.sets[0]?.reps !== want.reps) problems.push(`[${i}] reps ${item.sets[0]?.reps}, wanted ${want.reps}`);
    if (want.weightKg !== undefined) {
      const got1 = item.sets[0]?.weightKg;
      const ok = want.weightKg === null ? got1 === null : got1 !== null && Math.abs(got1! - want.weightKg) < 0.5;
      if (!ok) problems.push(`[${i}] weight ${got1}, wanted ${want.weightKg}`);
    }
    if (want.durationMin !== undefined && item.sets[0]?.durationMin !== want.durationMin) {
      problems.push(`[${i}] duration ${item.sets[0]?.durationMin}, wanted ${want.durationMin}`);
    }
  });

  if (problems.length) failures.push(`  "${testCase.input}"\n    ${problems.join("\n    ")}`);
  else passed++;
}

// Unknown movements must not be forced onto a real exercise.
const unknown = interpretWorkout("zercher kang squat 3x8", EXERCISES)[0];
if (!unknown.matched || unknown.confidence < 0.75) passed++;
else failures.push(`  "zercher kang squat" matched "${unknown.exercise?.name}" at ${unknown.confidence}`);

// Burn maths sanity: 30 min of running at MET 9.8 for a 90 kg person.
const burn = burnKcal(9.8, 30, 90);
if (burn > 400 && burn < 470) passed++;
else failures.push(`  burn for 30 min running at 90 kg was ${burn} kcal, expected ~440`);

// Epley 1RM: 100 kg x 5 -> ~117 kg.
const oneRm = estimateOneRepMax(100, 5);
if (Math.abs(oneRm - 116.7) < 0.5) passed++;
else failures.push(`  1RM for 100kg x5 was ${oneRm}, expected ~116.7`);

console.log(`${passed}/${CASES.length + 3} workout parser tests passed`);
if (failures.length) {
  console.log("\nFailures:\n" + failures.join("\n"));
  process.exit(1);
}
