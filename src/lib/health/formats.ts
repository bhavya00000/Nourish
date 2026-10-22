// Parsers for data pushed or uploaded from phones. Each returns a HealthBatch.
import { isIsoDate, normaliseActivity, type HealthBatch, type HealthDay, type HealthWorkout } from "./types.ts";

/** Shortcuts often send numbers as text: "12,345", "7.2 hr", "650 kcal". */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

/**
 * A duration in whatever form a phone produced it, as hours:
 * "6 hr 40 min", "6h40m", "06:40", "400 min", "24000 s", 6.7, 400, 24000.
 * A bare number is read as hours up to 24, minutes up to a day, else seconds.
 */
export function parseDurationHours(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return undefined;
    return value <= 24 ? value : value <= 1440 ? value / 60 : value / 3600;
  }
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase();

  const clock = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60 + Number(clock[3] ?? 0) / 3600;

  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)(?![a-z])/);
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes|minute|mins|min|m)(?![a-z])/);
  const sec = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds|second|secs|sec|s)(?![a-z])/);
  if (h || m || sec) return Number(h?.[1] ?? 0) + Number(m?.[1] ?? 0) / 60 + Number(sec?.[1] ?? 0) / 3600;

  const n = toNumber(s);
  return n === undefined ? undefined : parseDurationHours(n);
}

export function localToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** "2026-09-15 07:30:00 +0530" / ISO strings / "15/09/2026" -> "2026-09-15". */
export function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Day first: this app's users write 15/09/2026, not 09/15/2026.
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isIsoDate(iso) && Number(m) <= 12 && Number(d) <= 31 ? iso : undefined;
  }
  return undefined;
}

/** Health app timestamps carry their own offset: "2026-09-15 07:30:00 +0530". */
export function parseHealthTimestamp(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const offset = m[3] ? (m[3] === "Z" ? "Z" : m[3].replace(/^([+-]\d{2}):?(\d{2})$/, "$1:$2")) : "";
  const d = new Date(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}${offset}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const energyToKcal = (qty: number, unit = "kcal") => (/kj/i.test(unit) ? qty / 4.184 : qty);
const distanceToKm = (qty: number, unit = "km") => (/^mi/i.test(unit) ? qty * 1.60934 : /^m$|meter|metre/i.test(unit) ? qty / 1000 : qty);
const massToKg = (qty: number, unit = "kg") => (/lb|pound/i.test(unit) ? qty * 0.45359237 : qty);
/** Body fat arrives as 0.225 from some apps and 22.5 from others. */
const toPercent = (qty: number) => (qty > 0 && qty <= 1 ? qty * 100 : qty);

// ---------------------------------------------------------------- our own JSON

type SimpleDay = Record<string, unknown>;

function simpleDay(raw: SimpleDay, fallbackDate: string): HealthDay {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (raw[k] !== undefined && raw[k] !== "") return toNumber(raw[k]);
    return undefined;
  };

  const sleepHours =
    pick("sleepHours", "sleep_hours") ??
    (raw.sleep !== undefined && raw.sleep !== "" ? parseDurationHours(raw.sleep) : undefined) ??
    (pick("sleepMinutes", "sleep_minutes") !== undefined ? pick("sleepMinutes", "sleep_minutes")! / 60 : undefined) ??
    (pick("sleepSeconds", "sleep_seconds") !== undefined ? pick("sleepSeconds", "sleep_seconds")! / 3600 : undefined);

  const bodyFat = pick("bodyFatPct", "bodyFat", "body_fat");

  return {
    date: toIsoDate(raw.date) ?? fallbackDate,
    steps: pick("steps", "stepCount", "step_count"),
    sleepHours,
    activeKcal: pick("activeKcal", "activeEnergy", "active_energy", "activeCalories"),
    restingKcal: pick("restingKcal", "restingEnergy", "basalEnergy", "resting_energy"),
    restingHr: pick("restingHeartRate", "restingHr", "resting_hr"),
    distanceKm: pick("distanceKm", "distance", "distance_km"),
    weightKg: pick("weightKg", "weight", "weight_kg"),
    bodyFatPct: bodyFat !== undefined ? toPercent(bodyFat) : undefined,
  };
}

function simpleWorkouts(raw: unknown, fallbackDate: string): HealthWorkout[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((w: Record<string, unknown>) => {
    const start = parseHealthTimestamp(w.start ?? w.startDate);
    const end = parseHealthTimestamp(w.end ?? w.endDate);
    const durationMin =
      toNumber(w.durationMin) ?? (start && end ? (end.getTime() - start.getTime()) / 60000 : undefined);
    if (!durationMin) return [];
    const activity = normaliseActivity(String(w.type ?? w.activity ?? w.name ?? "other"));
    const date = toIsoDate(w.start ?? w.startDate ?? w.date) ?? fallbackDate;
    return [{
      externalId: String(w.id ?? `${activity}|${w.start ?? w.startDate ?? date}|${Math.round(durationMin)}`),
      date,
      activity,
      startedAt: start,
      durationMin,
      kcal: toNumber(w.kcal ?? w.activeKcal ?? w.energy),
      distanceKm: toNumber(w.distanceKm ?? w.distance),
    }];
  });
}

/**
 * The format our iOS Shortcut sends — deliberately flat and forgiving:
 *   { "date": "2026-09-15", "steps": "12,345", "sleepHours": 7.2, "activeKcal": 640 }
 * Also accepts { "days": [...] } or a bare array for backfilling.
 */
export function parseSimpleJson(body: unknown, source = "Health app"): HealthBatch {
  const today = localToday();
  const obj = (body ?? {}) as Record<string, unknown>;
  const list: SimpleDay[] = Array.isArray(body) ? (body as SimpleDay[]) : Array.isArray(obj.days) ? (obj.days as SimpleDay[]) : [obj];

  return {
    source: typeof obj.source === "string" && obj.source.trim() ? obj.source.trim().slice(0, 40) : source,
    days: list.map((d) => simpleDay(d, today)),
    workouts: list.flatMap((d) => simpleWorkouts(d.workouts, toIsoDate(d.date) ?? today)),
  };
}

// ---------------------------------------------------------------- Health Auto Export

type HaeMetric = { name?: string; units?: string; data?: Record<string, unknown>[] };

export const isHealthAutoExport = (body: unknown) =>
  Boolean(body && typeof body === "object" && (body as { data?: { metrics?: unknown } }).data &&
    Array.isArray((body as { data: { metrics?: unknown } }).data.metrics ?? (body as { data: { workouts?: unknown } }).data.workouts));

/**
 * Health Auto Export (iOS) posts its own JSON shape. Parsed defensively —
 * units vary with the user's settings, and field names have shifted between
 * versions — so anything unrecognised is skipped rather than guessed at.
 */
export function parseHealthAutoExport(body: unknown): HealthBatch {
  const data = (body as { data?: { metrics?: HaeMetric[]; workouts?: Record<string, unknown>[] } }).data ?? {};
  const days = new Map<string, HealthDay & { _hr?: number[] }>();
  const dayFor = (date: string) => {
    if (!days.has(date)) days.set(date, { date });
    return days.get(date)!;
  };
  const add = (day: HealthDay, key: "steps" | "activeKcal" | "restingKcal" | "distanceKm", value: number) => {
    day[key] = (day[key] ?? 0) + value;
  };

  for (const metric of data.metrics ?? []) {
    const name = String(metric.name ?? "").toLowerCase();
    const units = String(metric.units ?? "");

    for (const point of metric.data ?? []) {
      const date = toIsoDate(point.date ?? point.sleepEnd ?? point.inBedEnd);
      if (!date) continue;
      const qty = toNumber(point.qty ?? point.Avg ?? point.avg);
      const day = dayFor(date);

      if (name === "step_count" && qty !== undefined) add(day, "steps", qty);
      else if (name === "active_energy" && qty !== undefined) add(day, "activeKcal", energyToKcal(qty, units));
      else if ((name === "basal_energy_burned" || name === "resting_energy") && qty !== undefined) add(day, "restingKcal", energyToKcal(qty, units));
      else if (name === "walking_running_distance" && qty !== undefined) add(day, "distanceKm", distanceToKm(qty, units));
      else if (name === "resting_heart_rate" && qty !== undefined) (day._hr ??= []).push(qty);
      else if (name === "weight_body_mass" && qty !== undefined) day.weightKg = massToKg(qty, units);
      else if (name === "body_fat_percentage" && qty !== undefined) day.bodyFatPct = toPercent(qty);
      else if (name === "sleep_analysis") {
        // Newer versions summarise each night; older ones send raw samples.
        const staged = ["core", "deep", "rem"].map((k) => toNumber(point[k]) ?? 0).reduce((a, b) => a + b, 0);
        const hours = toNumber(point.totalSleep) ?? toNumber(point.asleep) ?? (staged || undefined) ?? qty;
        if (hours !== undefined) day.sleepHours = (day.sleepHours ?? 0) + (/min/i.test(units) ? hours / 60 : hours);
      }
    }
  }

  for (const day of days.values()) {
    if (day._hr?.length) day.restingHr = day._hr.reduce((a, b) => a + b, 0) / day._hr.length;
    delete day._hr;
  }

  const workouts: HealthWorkout[] = (data.workouts ?? []).flatMap((w) => {
    const start = parseHealthTimestamp(w.start);
    const end = parseHealthTimestamp(w.end);
    const date = toIsoDate(w.start);
    if (!date) return [];

    // Prefer the real span; "duration" has been seconds in some versions and minutes in others.
    const rawDuration = toNumber(w.duration);
    const durationMin = start && end ? (end.getTime() - start.getTime()) / 60000 : rawDuration !== undefined ? (rawDuration > 300 ? rawDuration / 60 : rawDuration) : 0;

    const energy = w.activeEnergyBurned as { qty?: unknown; units?: string } | undefined;
    const distance = w.distance as { qty?: unknown; units?: string } | undefined;
    const energyQty = toNumber(energy?.qty ?? w.activeEnergy);
    const distanceQty = toNumber(distance?.qty);

    return [{
      externalId: String(w.id ?? `${w.name}|${w.start}`),
      date,
      activity: normaliseActivity(String(w.name ?? "other")),
      startedAt: start,
      durationMin,
      kcal: energyQty !== undefined ? energyToKcal(energyQty, energy?.units) : undefined,
      distanceKm: distanceQty !== undefined ? distanceToKm(distanceQty, distance?.units) : undefined,
    }];
  });

  return { source: "Apple Health", days: [...days.values()], workouts };
}

// ---------------------------------------------------------------- CSV

/** Minimal RFC 4180 reader — quoted fields may contain commas. */
export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/**
 * Any spreadsheet with a date column and some of: steps, sleep, active
 * calories, resting heart rate, distance, weight, body fat. Column names are
 * matched loosely, and a unit in the header ("Distance (m)") is honoured.
 */
export function parseHealthCsv(text: string, source = "CSV"): HealthBatch {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length < 2) return { source, days: [], workouts: [] };

  const header = rows[0].map((h) => h.trim());
  const key = (h: string) => h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");
  const unitOf = (h: string) => h.match(/\((.*?)\)/)?.[1]?.trim() ?? "";

  const find = (pattern: RegExp) => header.findIndex((h) => pattern.test(key(h)));
  const col = {
    date: find(/^(date|day|startdate|starttime|timestamp)$/),
    steps: find(/^(steps?|stepcount|stepscount|totalsteps)$/),
    sleep: find(/^(sleep|sleephours|sleepduration|hoursslept|sleephrs|asleep|totalsleep)$/),
    sleepMin: find(/^(sleepminutes|sleepmins|minutesasleep)$/),
    active: find(/^(activecalories|activeenergy|activekcal|caloriesactive|activeenergyburned|moveenergy)$/),
    resting: find(/^(restingheartrate|restinghr|rhr)$/),
    distance: find(/^(distance|distancekm|totaldistance)$/),
    weight: find(/^(weight|weightkg|bodyweight|bodymass)$/),
    bodyFat: find(/^(bodyfat|bodyfatpercentage|bodyfatpct|fat)$/),
  };
  if (col.date < 0) throw new Error("The CSV needs a date column (named Date, Day or Start date).");

  const days: HealthDay[] = [];
  for (const cells of rows.slice(1)) {
    const date = toIsoDate(cells[col.date]);
    if (!date) continue;
    const num = (i: number) => (i >= 0 ? toNumber(cells[i]) : undefined);

    const sleep = num(col.sleep);
    const sleepMin = num(col.sleepMin);
    const distance = num(col.distance);
    const weight = num(col.weight);
    const fat = num(col.bodyFat);
    const active = num(col.active);

    days.push({
      date,
      steps: num(col.steps),
      sleepHours: sleep !== undefined ? (/min/i.test(unitOf(header[col.sleep])) ? sleep / 60 : sleep) : sleepMin !== undefined ? sleepMin / 60 : undefined,
      activeKcal: active !== undefined ? energyToKcal(active, unitOf(header[col.active]) || "kcal") : undefined,
      restingHr: num(col.resting),
      distanceKm: distance !== undefined ? distanceToKm(distance, unitOf(header[col.distance]) || "km") : undefined,
      weightKg: weight !== undefined ? massToKg(weight, unitOf(header[col.weight]) || "kg") : undefined,
      bodyFatPct: fat !== undefined ? toPercent(fat) : undefined,
    });
  }
  return { source, days, workouts: [] };
}
