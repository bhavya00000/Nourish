// Every "how many calories" number in the app comes from here, so the API,
// the reports and the AI prompts always quote the same figures.

export const KCAL_PER_KG = 7700;

/** Multiplier on BMR for everything that is not deliberate exercise. */
export const JOB_MULTIPLIER = {
  desk: 1.2,
  standing: 1.35,
  field: 1.5,
  labour: 1.7,
} as const;

/** Average kcal burnt in one session, given for 75 kg and scaled by bodyweight. */
export const GYM_SESSION_KCAL = {
  none: 0,
  yoga: 180,
  cardio: 380,
  weights: 320,
  mixed: 360,
  sports: 420,
} as const;

export type ProfileInput = {
  sex?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  jobRole?: string | null;
  gymType?: string | null;
  gymDays?: number | null;
  walkMinutes?: number | null;
  adaptiveTdee?: boolean | null;
  learnedTdee?: number | null;
  /** When true the estimated training burn is left out of the baseline, because
   *  each day's actually-logged workout is added to that day instead. */
  useLoggedWorkouts?: boolean | null;
};

export type GoalInput = {
  goalType?: string | null;
  targetWeight?: number | null;
  targetWeeks?: number | null;
  customCalories?: number | null;
};

export type Targets = ReturnType<typeof calorieTarget>;

export function bmr({ sex, weightKg, heightCm, age }: ProfileInput) {
  const base = 10 * (weightKg ?? 0) + 6.25 * (heightCm ?? 0) - 5 * (age ?? 0);
  return Math.round(sex === "female" ? base - 161 : base + 5);
}

/**
 * Walking is counted explicitly rather than hidden inside an activity factor,
 * because a couple of short daily walks genuinely move the number.
 */
export function walkKcalPerDay(minutes: number, weightKg: number) {
  if (!minutes) return 0;
  const MET = 3.5; // ~4.5 km/h
  return Math.round(((MET * 3.5 * weightKg) / 200) * minutes);
}

/**
 * Calories from a day's step count that are *not* already in the baseline.
 * The job multiplier covers ordinary daily movement (roughly 5,000 steps) and
 * the walking estimate covers deliberate walks, so only steps beyond both are
 * extra — otherwise the same walking would be counted twice.
 */
export function extraStepKcal(steps: number, weightKg: number, walkMinutes: number) {
  if (!steps || steps <= 5000) return 0;
  const kcalPerStep = 0.04 * (weightKg / 70);
  const beyondBaseline = (steps - 5000) * kcalPerStep;
  return Math.max(0, Math.round(beyondBaseline - walkKcalPerDay(walkMinutes, weightKg)));
}

/**
 * How a watch-measured day compares with the activity your target assumes.
 *
 * Active energy is everything burnt above resting, so it already contains your
 * steps and workouts. Your maintenance figure assumes (maintenance − BMR) of
 * that on an average day; the difference is what this day earned or fell short.
 *
 * A day still in progress can only earn, never lose: at 10am the watch has
 * barely started counting, and shrinking the target then would be wrong.
 */
export function measuredActivityAdjustment(
  activeKcal: number,
  targets: { tdee: number; bmr: number },
  dayIsComplete: boolean
) {
  const assumedActive = Math.max(0, targets.tdee - targets.bmr);
  const difference = Math.round(activeKcal - assumedActive);
  return dayIsComplete ? difference : Math.max(0, difference);
}

export function gymKcalPerDay(gymType: string, gymDays: number, weightKg: number) {
  const perSession =
    (GYM_SESSION_KCAL[gymType as keyof typeof GYM_SESSION_KCAL] ?? 0) * (weightKg / 75);
  return Math.round((perSession * (gymDays || 0)) / 7);
}

export function estimateTdee(profile: ProfileInput) {
  const weight = profile.weightKg ?? 0;
  const b = bmr(profile);
  const jobMultiplier =
    JOB_MULTIPLIER[(profile.jobRole ?? "desk") as keyof typeof JOB_MULTIPLIER] ?? 1.2;
  const base = Math.round(b * jobMultiplier);
  const walk = walkKcalPerDay(profile.walkMinutes ?? 0, weight);
  const estimatedGym = gymKcalPerDay(profile.gymType ?? "none", profile.gymDays ?? 0, weight);

  // Counting both an average estimate and the day's real session would double
  // count the same training, so only one of them is ever in the number.
  const excludesTraining = Boolean(profile.useLoggedWorkouts);
  const gym = excludesTraining ? 0 : estimatedGym;
  const formula = base + walk + gym;

  // Adaptive TDEE: once there is enough data, what actually happened to the
  // user's weight beats any formula.
  const useLearned =
    Boolean(profile.adaptiveTdee) &&
    typeof profile.learnedTdee === "number" &&
    profile.learnedTdee > 800;

  return {
    bmr: b,
    jobMultiplier,
    base,
    walk,
    gym,
    estimatedGym,
    excludesTraining,
    formulaTdee: formula,
    learnedTdee: useLearned ? Math.round(profile.learnedTdee!) : null,
    tdee: useLearned ? Math.round(profile.learnedTdee!) : formula,
  };
}

/**
 * Derive the true maintenance intake from observed weight change:
 *   TDEE = average intake + (weight change in kcal / days)
 * Losing weight faster than intake predicts means maintenance is higher.
 */
export function learnTdee(
  samples: { avgIntake: number; startWeight: number; endWeight: number; days: number },
  fallback: number
) {
  const { avgIntake, startWeight, endWeight, days } = samples;
  if (days < 10 || avgIntake < 500) return null;

  const kgChange = endWeight - startWeight;
  const learned = avgIntake - (kgChange * KCAL_PER_KG) / days;

  // Reject anything implausible: bad weigh-ins and missed logging both show up
  // as wild numbers, and a wrong TDEE is worse than the formula estimate.
  if (learned < fallback * 0.65 || learned > fallback * 1.45) return null;
  return Math.round(learned);
}

export function calorieTarget(profile: ProfileInput, goal?: GoalInput | null) {
  const energy = estimateTdee(profile);
  const weight = profile.weightKg ?? 0;
  const notes: string[] = [];
  const goalType = goal?.goalType ?? "maintain";

  if (energy.learnedTdee) {
    notes.push(
      `Maintenance is measured from your own data (${energy.learnedTdee} kcal), not the ${energy.formulaTdee} kcal the formula predicts.`
    );
  }

  if (goalType === "maintain") {
    return finalise(energy, energy.tdee, weight, profile, goal, [
      ...notes,
      "Maintaining your current weight.",
    ]);
  }

  if (goalType === "recomp") {
    notes.push("Recomposition: eating near maintenance with high protein and progressive training.");
    return finalise(energy, energy.tdee - 150, weight, profile, goal, notes);
  }

  const target = goal?.targetWeight ?? weight;
  const weeks = Math.max(1, goal?.targetWeeks || 12);
  const deltaKg = target - weight;
  let dailyDelta = (deltaKg * KCAL_PER_KG) / (weeks * 7);

  // Cap the rate: ~1% of bodyweight per week losing, ~0.5% gaining. Past that
  // you mostly lose muscle or gain fat.
  const maxLossPerWeek = weight * 0.01;
  const maxGainPerWeek = weight * 0.005;
  const requestedPerWeek = Math.abs(deltaKg) / weeks;

  if (deltaKg < 0 && requestedPerWeek > maxLossPerWeek) {
    dailyDelta = -(maxLossPerWeek * KCAL_PER_KG) / 7;
    notes.push(
      `${requestedPerWeek.toFixed(2)} kg/week is faster than is sustainable — capped at ${maxLossPerWeek.toFixed(2)} kg/week.`
    );
  }
  if (deltaKg > 0 && requestedPerWeek > maxGainPerWeek) {
    dailyDelta = (maxGainPerWeek * KCAL_PER_KG) / 7;
    notes.push(
      `${requestedPerWeek.toFixed(2)} kg/week of gain would be mostly fat — capped at ${maxGainPerWeek.toFixed(2)} kg/week.`
    );
  }
  if (dailyDelta < 0 && Math.abs(dailyDelta) > energy.tdee * 0.25) {
    dailyDelta = -energy.tdee * 0.25;
    notes.push("Deficit limited to 25% of maintenance.");
  }

  return finalise(energy, energy.tdee + dailyDelta, weight, profile, goal, notes);
}

function finalise(
  energy: ReturnType<typeof estimateTdee>,
  rawCalories: number,
  weight: number,
  profile: ProfileInput,
  goal: GoalInput | null | undefined,
  notes: string[]
) {
  const floor = profile.sex === "female" ? 1200 : 1500;
  let calories = Math.round(rawCalories / 10) * 10;

  if (calories < floor) {
    calories = floor;
    notes.push(
      `Raised to the ${floor} kcal minimum for a ${profile.sex === "female" ? "woman" : "man"} of your size.`
    );
  }
  if (goal?.customCalories) {
    calories = goal.customCalories;
    notes.push("Using your manually set calorie target.");
  }

  const goalType = goal?.goalType ?? "maintain";
  const macros = macroSplit(calories, weight, goalType);
  const dailyDelta = calories - energy.tdee;
  const weeklyKg = (dailyDelta * 7) / KCAL_PER_KG;

  let etaWeeks: number | null = null;
  if (goal?.targetWeight && Math.abs(weeklyKg) > 0.01) {
    const remaining = goal.targetWeight - weight;
    if (Math.sign(remaining) === Math.sign(weeklyKg)) {
      etaWeeks = Math.ceil(Math.abs(remaining / weeklyKg));
    }
  }

  const etaDate = etaWeeks
    ? new Date(Date.now() + etaWeeks * 7 * 86400000).toISOString().slice(0, 10)
    : null;

  return {
    ...energy,
    calories,
    floor,
    macros,
    dailyDelta: Math.round(dailyDelta),
    projectedKgPerWeek: Number(weeklyKg.toFixed(2)),
    etaWeeks,
    etaDate,
    waterMl: Math.round((weight * 35) / 100) * 100,
    fiberG: Math.round((calories / 1000) * 14),
    notes,
  };
}

/** Protein first (it protects muscle in a deficit), then fat, carbs take the rest. */
export function macroSplit(calories: number, weight: number, goalType: string) {
  const perKg = ({ lose: 1.8, recomp: 2.0, gain: 1.8, maintain: 1.4 } as Record<string, number>)[goalType] ?? 1.6;
  let protein = Math.round(weight * perKg);
  let fat = Math.round((calories * 0.27) / 9);
  const minFat = Math.round(weight * 0.6);
  if (fat < minFat) fat = minFat;

  let carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  if (carbs < 50) {
    // Trim protein back toward 1.4 g/kg rather than starving carbs completely.
    protein = Math.max(Math.round(weight * 1.4), Math.round((calories - fat * 9 - 200) / 4));
    carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  }
  return { protein, carbs, fat };
}

export const MEALS = ["breakfast", "lunch", "snacks", "dinner", "event"] as const;
export type Meal = (typeof MEALS)[number];

export const OPTIONS = {
  jobRole: Object.keys(JOB_MULTIPLIER),
  gymType: Object.keys(GYM_SESSION_KCAL),
  goalType: ["lose", "gain", "recomp", "maintain"],
  meals: MEALS,
};
