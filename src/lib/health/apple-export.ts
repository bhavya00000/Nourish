// Streaming reader for the Health app's "Export All Health Data" file.
//
// export.xml can be hundreds of megabytes, so it is never held in memory:
// bytes are unzipped as they arrive, split into lines (Apple writes one record
// per line) and folded into small per-day totals.
import { Unzip, UnzipInflate } from "fflate";
import { normaliseActivity, type HealthBatch, type HealthWorkout } from "./types.ts";
import { parseHealthTimestamp } from "./formats.ts";

const ASLEEP = new Set([
  "HKCategoryValueSleepAnalysisAsleep",
  "HKCategoryValueSleepAnalysisAsleepUnspecified",
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
]);

const SUMMED: Record<string, "steps" | "activeKcal" | "restingKcal" | "distanceKm"> = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierActiveEnergyBurned: "activeKcal",
  HKQuantityTypeIdentifierBasalEnergyBurned: "restingKcal",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distanceKm",
};

function attributes(line: string) {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

const energy = (value: number, unit: string) => (/kj/i.test(unit) ? value / 4.184 : value);
const distance = (value: number, unit: string) => (unit === "mi" ? value * 1.60934 : unit === "m" ? value / 1000 : value);
const mass = (value: number, unit: string) => (/lb/i.test(unit) ? value * 0.45359237 : value);

export class AppleHealthAggregator {
  /** date -> metric -> source -> total. Totals are kept per source because… */
  private summed = new Map<string, Map<string, Map<string, number>>>();
  /** date -> source -> asleep intervals [start, end] in ms. */
  private sleep = new Map<string, Map<string, [number, number][]>>();
  private restingHr = new Map<string, number[]>();
  private weight = new Map<string, { at: number; kg: number }>();
  private bodyFat = new Map<string, { at: number; pct: number }>();
  private workouts: HealthWorkout[] = [];
  private openWorkout: (HealthWorkout & { _energy?: number; _distance?: number }) | null = null;
  private carry = "";
  records = 0;
  private since: string;

  constructor(since: string) {
    this.since = since;
  }

  /** Feed decoded text; lines split across chunks are carried over. */
  push(text: string) {
    const lines = (this.carry + text).split("\n");
    this.carry = lines.pop() ?? "";
    for (const line of lines) this.line(line.trim());
  }

  private line(line: string) {
    if (line.startsWith("<Record ")) return this.record(attributes(line));
    if (line.startsWith("<Workout ")) {
      this.startWorkout(attributes(line));
      if (line.endsWith("/>")) this.closeWorkout();
      return;
    }
    if (this.openWorkout && line.startsWith("<WorkoutStatistics ")) {
      const a = attributes(line);
      const sum = Number(a.sum);
      if (!Number.isFinite(sum)) return;
      if (a.type === "HKQuantityTypeIdentifierActiveEnergyBurned") this.openWorkout._energy = energy(sum, a.unit ?? "kcal");
      if (/Distance/.test(a.type ?? "")) this.openWorkout._distance = distance(sum, a.unit ?? "km");
      return;
    }
    if (line.startsWith("</Workout>")) this.closeWorkout();
  }

  private record(a: Record<string, string>) {
    const date = (a.startDate ?? "").slice(0, 10);
    if (!date || date < this.since) {
      // Sleep that ends inside the window may have started just before it.
      if (!(a.type === "HKCategoryTypeIdentifierSleepAnalysis" && (a.endDate ?? "").slice(0, 10) >= this.since)) return;
    }
    this.records++;
    const source = a.sourceName ?? "unknown";
    const value = Number(a.value);

    const metric = SUMMED[a.type];
    if (metric && Number.isFinite(value)) {
      const v = metric === "activeKcal" || metric === "restingKcal" ? energy(value, a.unit) : metric === "distanceKm" ? distance(value, a.unit) : value;
      const byMetric = this.summed.get(date) ?? new Map();
      const bySource = byMetric.get(metric) ?? new Map();
      bySource.set(source, (bySource.get(source) ?? 0) + v);
      byMetric.set(metric, bySource);
      this.summed.set(date, byMetric);
      return;
    }

    if (a.type === "HKQuantityTypeIdentifierRestingHeartRate" && Number.isFinite(value)) {
      const list = this.restingHr.get(date) ?? [];
      list.push(value);
      this.restingHr.set(date, list);
      return;
    }

    if (a.type === "HKQuantityTypeIdentifierBodyMass" && Number.isFinite(value)) {
      const at = parseHealthTimestamp(a.startDate)?.getTime() ?? 0;
      const prev = this.weight.get(date);
      if (!prev || at >= prev.at) this.weight.set(date, { at, kg: mass(value, a.unit) });
      return;
    }

    if (a.type === "HKQuantityTypeIdentifierBodyFatPercentage" && Number.isFinite(value)) {
      const at = parseHealthTimestamp(a.startDate)?.getTime() ?? 0;
      const prev = this.bodyFat.get(date);
      if (!prev || at >= prev.at) this.bodyFat.set(date, { at, pct: value <= 1 ? value * 100 : value });
      return;
    }

    if (a.type === "HKCategoryTypeIdentifierSleepAnalysis" && ASLEEP.has(a.value)) {
      const start = parseHealthTimestamp(a.startDate)?.getTime();
      const end = parseHealthTimestamp(a.endDate)?.getTime();
      if (!start || !end || end <= start) return;
      // A night belongs to the morning you wake up on.
      const wake = (a.endDate ?? "").slice(0, 10);
      const bySource = this.sleep.get(wake) ?? new Map();
      const list = bySource.get(source) ?? [];
      list.push([start, end]);
      bySource.set(source, list);
      this.sleep.set(wake, bySource);
    }
  }

  private startWorkout(a: Record<string, string>) {
    const date = (a.startDate ?? "").slice(0, 10);
    if (!date || date < this.since) {
      this.openWorkout = null;
      return;
    }
    const start = parseHealthTimestamp(a.startDate);
    const end = parseHealthTimestamp(a.endDate);
    const reported = Number(a.duration);
    const durationMin = Number.isFinite(reported)
      ? /^s/.test(a.durationUnit ?? "min") ? reported / 60 : /^h/.test(a.durationUnit ?? "") ? reported * 60 : reported
      : start && end ? (end.getTime() - start.getTime()) / 60000 : 0;

    this.openWorkout = {
      externalId: `${a.workoutActivityType}|${a.startDate}`,
      date,
      activity: normaliseActivity(a.workoutActivityType ?? "other"),
      startedAt: start,
      durationMin,
      // Older exports put totals on the element; newer ones use child statistics.
      _energy: a.totalEnergyBurned ? energy(Number(a.totalEnergyBurned), a.totalEnergyBurnedUnit ?? "kcal") : undefined,
      _distance: a.totalDistance ? distance(Number(a.totalDistance), a.totalDistanceUnit ?? "km") : undefined,
    };
  }

  private closeWorkout() {
    const w = this.openWorkout;
    this.openWorkout = null;
    if (!w) return;
    this.workouts.push({
      externalId: w.externalId,
      date: w.date,
      activity: w.activity,
      startedAt: w.startedAt,
      durationMin: w.durationMin,
      kcal: w._energy,
      distanceKm: w._distance,
    });
  }

  finish(): HealthBatch {
    if (this.carry) this.line(this.carry.trim());
    this.carry = "";

    const dates = new Set([...this.summed.keys(), ...this.sleep.keys(), ...this.restingHr.keys(), ...this.weight.keys(), ...this.bodyFat.keys()]);
    const days = [...dates]
      .filter((date) => date >= this.since)
      .sort()
      .map((date) => {
        const summed = this.summed.get(date);
        // …an iPhone and an Apple Watch both record the same walk. Adding them
        // double counts; the Health app shows the best single source instead.
        const best = (metric: string) => {
          const bySource = summed?.get(metric);
          return bySource?.size ? Math.max(...bySource.values()) : undefined;
        };

        // Watch sleep stages and a phone's "asleep" can cover the same hours,
        // so merge overlaps within each source and take the best source.
        let sleepHours: number | undefined;
        const bySource = this.sleep.get(date);
        if (bySource?.size) {
          const perSource = [...bySource.values()].map((intervals) => {
            const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
            let total = 0;
            let [curStart, curEnd] = sorted[0];
            for (const [s, e] of sorted.slice(1)) {
              if (s <= curEnd) curEnd = Math.max(curEnd, e);
              else { total += curEnd - curStart; [curStart, curEnd] = [s, e]; }
            }
            total += curEnd - curStart;
            return total / 3600000;
          });
          sleepHours = Math.max(...perSource);
        }

        const hr = this.restingHr.get(date);
        return {
          date,
          steps: best("steps"),
          activeKcal: best("activeKcal"),
          restingKcal: best("restingKcal"),
          distanceKm: best("distanceKm"),
          sleepHours,
          restingHr: hr?.length ? hr.reduce((a, b) => a + b, 0) / hr.length : undefined,
          weightKg: this.weight.get(date)?.kg,
          bodyFatPct: this.bodyFat.get(date)?.pct,
        };
      });

    return { source: "Apple Health", days, workouts: this.workouts };
  }
}

/**
 * Read an upload that is either the export .zip or a bare export.xml.
 * Resolves once the stream ends.
 */
export async function readAppleHealthExport(stream: ReadableStream<Uint8Array>, since: string) {
  const aggregator = new AppleHealthAggregator(since);
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let mode: "unknown" | "zip" | "xml" = "unknown";
  let foundXml = false;
  let unzip: Unzip | null = null;
  let fileError: Error | null = null;

  const startZip = () => {
    unzip = new Unzip((file) => {
      // Apple also ships export_cda.xml (clinical records); only export.xml matters.
      if (!/(^|\/)export\.xml$/.test(file.name)) return;
      foundXml = true;
      const fileDecoder = new TextDecoder();
      file.ondata = (err, chunk, final) => {
        if (err) { fileError = err; return; }
        aggregator.push(fileDecoder.decode(chunk, { stream: !final }));
      };
      file.start();
    });
    unzip.register(UnzipInflate);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value?.length) continue;

    if (mode === "unknown") {
      const zipMagic = value[0] === 0x50 && value[1] === 0x4b;
      mode = zipMagic ? "zip" : "xml";
      if (mode === "zip") startZip();
      else foundXml = true;
    }

    if (mode === "zip") unzip!.push(value);
    else aggregator.push(decoder.decode(value, { stream: true }));
    if (fileError) throw fileError;
  }

  if (mode === "zip") unzip!.push(new Uint8Array(0), true);
  else aggregator.push(decoder.decode());
  if (fileError) throw fileError;

  if (mode === "unknown") throw new Error("The file was empty.");
  if (!foundXml) throw new Error("That zip does not contain export.xml. Use the file from Health → your profile → Export All Health Data.");

  return { batch: aggregator.finish(), records: aggregator.records };
}
