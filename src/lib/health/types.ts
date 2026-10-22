// Every health source — an iOS Shortcut, Health Auto Export, an Apple Health
// export file, a CSV — is converted into this one shape before anything is
// written, so the rules for merging and de-duplicating live in one place.

export type HealthDay = {
  date: string; // YYYY-MM-DD, in the device's local time
  steps?: number;
  sleepHours?: number;
  activeKcal?: number;
  restingKcal?: number;
  restingHr?: number;
  distanceKm?: number;
  weightKg?: number;
  bodyFatPct?: number;
};

export type HealthWorkout = {
  externalId: string;
  date: string;
  activity: string; // normalised: running, walking, cycling, strength…
  startedAt?: Date;
  durationMin: number;
  kcal?: number;
  distanceKm?: number;
};

export type HealthBatch = {
  source: string;
  days: HealthDay[];
  workouts: HealthWorkout[];
};

export const isIsoDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Drop anything physiologically impossible rather than store garbage. */
export function sanitiseDay(day: HealthDay): HealthDay | null {
  if (!isIsoDate(day.date)) return null;
  const within = (v: number | undefined, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;

  const clean: HealthDay = {
    date: day.date,
    steps: within(day.steps, 0, 150_000) !== undefined ? Math.round(day.steps!) : undefined,
    // A phone with no watch, or no sleep tracked, reports 0 — that means "not
    // measured", and must not replace the step estimate or a typed-in value.
    sleepHours: within(day.sleepHours, 0.01, 20) !== undefined ? Math.round(day.sleepHours! * 100) / 100 : undefined,
    activeKcal: within(day.activeKcal, 1, 8000),
    restingKcal: within(day.restingKcal, 400, 5000),
    restingHr: within(day.restingHr, 25, 150),
    distanceKm: within(day.distanceKm, 0, 300),
    weightKg: within(day.weightKg, 25, 400),
    bodyFatPct: within(day.bodyFatPct, 2, 70),
  };

  const hasData = Object.entries(clean).some(([k, v]) => k !== "date" && v !== undefined);
  return hasData ? clean : null;
}

/** Map the many names health apps use for a workout onto ours. */
export function normaliseActivity(raw: string) {
  const s = raw.toLowerCase().replace(/^hkworkoutactivitytype/, "").replace(/[^a-z]/g, "");
  const table: [RegExp, string][] = [
    [/run|jog/, "running"],
    [/walk|hik/, "walking"],
    [/cycl|bik|spin/, "cycling"],
    [/swim/, "swimming"],
    [/elliptical/, "elliptical"],
    [/row/, "rowing"],
    [/stair/, "stairs"],
    [/hiit|highintensity|interval|crosstraining|mixedcardio/, "hiit"],
    [/strength|weight|functional|coretraining/, "strength"],
    [/yoga/, "yoga"],
    [/pilates/, "pilates"],
    [/dance/, "dance"],
    [/soccer|football/, "football"],
    [/cricket/, "cricket"],
    [/badminton/, "badminton"],
    [/basketball/, "basketball"],
    [/tennis/, "tennis"],
    [/box|kickbox|martialart/, "boxing"],
    [/jumprope|skip/, "skipping"],
    [/flexib|stretch|cooldown/, "stretching"],
  ];
  return table.find(([pattern]) => pattern.test(s))?.[1] ?? "other";
}
