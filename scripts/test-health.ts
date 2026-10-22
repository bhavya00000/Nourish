// Regression tests for health data parsing. Run: npm run test:health
import { zipSync, strToU8 } from "fflate";
import { AppleHealthAggregator, readAppleHealthExport } from "../src/lib/health/apple-export.ts";
import { parseDurationHours, parseHealthAutoExport, parseHealthCsv, parseSimpleJson, isHealthAutoExport } from "../src/lib/health/formats.ts";
import { sanitiseDay } from "../src/lib/health/types.ts";

let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed++;
  else failures.push(`  ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (a: number | undefined, b: number, tol = 0.05) => typeof a === "number" && Math.abs(a - b) <= tol;

// A trimmed but faithful Apple Health export.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [ <!ELEMENT HealthData (ExportDate,Me,(Record|Workout)*)> ]>
<HealthData locale="en_IN">
 <ExportDate value="2026-09-15 08:00:00 +0530"/>
 <Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-09-13 08:00:00 +0530" endDate="2026-09-13 09:00:00 +0530" value="2500"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-09-13 18:00:00 +0530" endDate="2026-09-13 19:00:00 +0530" value="3500"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Bhavya's Apple Watch" unit="count" startDate="2026-09-13 08:00:00 +0530" endDate="2026-09-13 09:00:00 +0530" value="3000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Bhavya's Apple Watch" unit="count" startDate="2026-09-13 18:00:00 +0530" endDate="2026-09-13 19:00:00 +0530" value="5200"/>
 <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Bhavya's Apple Watch" unit="kJ" startDate="2026-09-13 18:00:00 +0530" endDate="2026-09-13 19:00:00 +0530" value="2092"/>
 <Record type="HKQuantityTypeIdentifierBasalEnergyBurned" sourceName="Bhavya's Apple Watch" unit="Cal" startDate="2026-09-13 00:00:00 +0530" endDate="2026-09-13 23:59:00 +0530" value="1850"/>
 <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="Bhavya's Apple Watch" unit="km" startDate="2026-09-13 18:00:00 +0530" endDate="2026-09-13 19:00:00 +0530" value="6.2"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Bhavya's Apple Watch" unit="count/min" startDate="2026-09-13 07:00:00 +0530" endDate="2026-09-13 07:00:00 +0530" value="58"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Bhavya's Apple Watch" unit="count/min" startDate="2026-09-13 21:00:00 +0530" endDate="2026-09-13 21:00:00 +0530" value="62"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb" startDate="2026-09-13 07:10:00 +0530" endDate="2026-09-13 07:10:00 +0530" value="198.5"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb" startDate="2026-09-13 21:10:00 +0530" endDate="2026-09-13 21:10:00 +0530" value="199.4"/>
 <Record type="HKQuantityTypeIdentifierBodyFatPercentage" sourceName="Scale" unit="%" startDate="2026-09-13 07:10:00 +0530" endDate="2026-09-13 07:10:00 +0530" value="0.225"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="iPhone" startDate="2026-09-13 23:00:00 +0530" endDate="2026-09-14 07:00:00 +0530" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Bhavya's Apple Watch" startDate="2026-09-13 23:30:00 +0530" endDate="2026-09-14 01:30:00 +0530" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Bhavya's Apple Watch" startDate="2026-09-14 01:30:00 +0530" endDate="2026-09-14 03:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Bhavya's Apple Watch" startDate="2026-09-14 03:00:00 +0530" endDate="2026-09-14 03:20:00 +0530" value="HKCategoryValueSleepAnalysisAwake"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Bhavya's Apple Watch" startDate="2026-09-14 03:20:00 +0530" endDate="2026-09-14 05:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepREM"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Bhavya's Apple Watch" startDate="2026-09-14 05:00:00 +0530" endDate="2026-09-14 06:30:00 +0530" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Sleep Tracker" startDate="2026-09-14 00:00:00 +0530" endDate="2026-09-14 04:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Sleep Tracker" startDate="2026-09-14 03:00:00 +0530" endDate="2026-09-14 06:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2025-01-01 08:00:00 +0530" endDate="2025-01-01 09:00:00 +0530" value="99999"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Bhavya's Apple Watch" startDate="2026-08-31 23:00:00 +0530" endDate="2026-09-01 06:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32.5" durationUnit="min" totalDistance="5.1" totalDistanceUnit="km" totalEnergyBurned="341" totalEnergyBurnedUnit="Cal" sourceName="Bhavya's Apple Watch" startDate="2026-09-13 18:05:00 +0530" endDate="2026-09-13 18:37:30 +0530"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="48" durationUnit="min" sourceName="Bhavya's Apple Watch" startDate="2026-09-14 07:00:00 +0530" endDate="2026-09-14 07:48:00 +0530">
  <MetadataEntry key="HKIndoorWorkout" value="1"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-09-14 07:00:00 +0530" endDate="2026-09-14 07:48:00 +0530" sum="286" unit="Cal"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierBasalEnergyBurned" startDate="2026-09-14 07:00:00 +0530" endDate="2026-09-14 07:48:00 +0530" sum="61" unit="Cal"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="1" durationUnit="hr" sourceName="Bhavya's Apple Watch" startDate="2025-02-01 07:00:00 +0530" endDate="2025-02-01 08:00:00 +0530"/>
</HealthData>
`;

// 1. Aggregation, fed in deliberately awkward chunk sizes so lines split mid-attribute.
const agg = new AppleHealthAggregator("2026-09-01");
for (let i = 0; i < XML.length; ) {
  const size = 7 + ((i * 31) % 97);
  agg.push(XML.slice(i, i + size));
  i += size;
}
const batch = agg.finish();
const d13 = batch.days.find((d) => d.date === "2026-09-13");
const d14 = batch.days.find((d) => d.date === "2026-09-14");
const d01 = batch.days.find((d) => d.date === "2026-09-01");

check("steps: phone + watch are not added together (best source wins)", d13?.steps === 8200, `got ${d13?.steps}, want 8200 not 14200`);
check("active energy converted from kJ", near(d13?.activeKcal, 500, 0.5), `got ${d13?.activeKcal}`);
check("resting energy in 'Cal' treated as kcal", d13?.restingKcal === 1850, `got ${d13?.restingKcal}`);
check("distance", near(d13?.distanceKm, 6.2), `got ${d13?.distanceKm}`);
check("resting heart rate averaged", d13?.restingHr === 60, `got ${d13?.restingHr}`);
check("weight: last reading of the day, converted from lb", near(d13?.weightKg, 90.45, 0.05), `got ${d13?.weightKg}`);
check("body fat fraction -> percent", near(d13?.bodyFatPct, 22.5), `got ${d13?.bodyFatPct}`);
check("sleep: watch stages minus the awake gap, 'in bed' ignored", near(d14?.sleepHours, 6.667, 0.01), `got ${d14?.sleepHours}, want 6h40m`);
check("sleep attributed to the wake-up morning, not the night before", !batch.days.find((d) => d.date === "2026-09-13")?.sleepHours);
check("records before the window are dropped", !batch.days.some((d) => d.date < "2026-09-01"), batch.days.map((d) => d.date).join(","));
check("a night that started before the window but ended in it is kept", near(d01?.sleepHours, 7), `got ${d01?.sleepHours}`);

const run = batch.workouts.find((w) => w.activity === "running");
const lift = batch.workouts.find((w) => w.activity === "strength");
check("workout (old format): totals from attributes", run?.durationMin === 32.5 && run?.kcal === 341 && near(run?.distanceKm, 5.1), JSON.stringify(run));
check("workout (new format): energy from WorkoutStatistics child", lift?.durationMin === 48 && lift?.kcal === 286, JSON.stringify(lift));
check("workouts before the window are dropped", batch.workouts.length === 2, `got ${batch.workouts.length}`);

// Overlap merge on its own: the "Sleep Tracker" source had 00:00-04:00 and 03:00-06:00 = 6h merged (7h if summed).
const overlap = new AppleHealthAggregator("2026-01-01");
overlap.push(`<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="A" startDate="2026-09-14 00:00:00 +0530" endDate="2026-09-14 04:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="A" startDate="2026-09-14 03:00:00 +0530" endDate="2026-09-14 06:00:00 +0530" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
`);
check("overlapping sleep merged within a source", near(overlap.finish().days[0]?.sleepHours, 6), `got ${overlap.finish().days[0]?.sleepHours}`);

// 2. Through the streaming reader: plain xml, a zip, and a zip read in tiny network-sized chunks.
const toStream = (bytes: Uint8Array, chunk = 64 * 1024) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
      controller.close();
    },
  });

const xmlBytes = strToU8(XML);
const fromXml = await readAppleHealthExport(toStream(xmlBytes), "2026-09-01");
check("reader: bare export.xml", fromXml.batch.days.find((d) => d.date === "2026-09-13")?.steps === 8200);

const zipped = zipSync({ "apple_health_export/export.xml": xmlBytes, "apple_health_export/export_cda.xml": strToU8("<ClinicalDocument/>") });
const fromZip = await readAppleHealthExport(toStream(zipped, 333), "2026-09-01");
check("reader: export.zip in 333-byte chunks, export_cda.xml ignored", fromZip.batch.days.find((d) => d.date === "2026-09-14")?.sleepHours !== undefined && fromZip.batch.workouts.length === 2);

const wrongZip = zipSync({ "photos/readme.txt": strToU8("hello") });
let wrongZipError = "";
await readAppleHealthExport(toStream(wrongZip), "2026-09-01").catch((e) => (wrongZipError = e.message));
check("reader: a zip without export.xml is rejected with a helpful message", /export\.xml/.test(wrongZipError), wrongZipError);

// 3. The Shortcut JSON — numbers arrive as text.
const simple = parseSimpleJson({ date: "2026-09-15", steps: "12,345", sleepMinutes: "432", activeKcal: "640 kcal", weight: "89.4", bodyFat: 0.21, source: "iPhone Shortcut" });
const s0 = simple.days[0];
check("shortcut JSON: comma-separated steps", s0.steps === 12345, `got ${s0.steps}`);
check("shortcut JSON: sleep minutes -> hours", near(s0.sleepHours, 7.2), `got ${s0.sleepHours}`);
check("shortcut JSON: '640 kcal' string", s0.activeKcal === 640);
check("shortcut JSON: source label kept", simple.source === "iPhone Shortcut");
check("shortcut JSON: backfill via days[]", parseSimpleJson({ days: [{ date: "2026-09-10", steps: 1 }, { date: "2026-09-11", steps: 2 }] }).days.length === 2);

// Sleep durations in every shape Shortcuts might produce.
for (const [input, hours] of [["6 hr 40 min", 6.667], ["6h40m", 6.667], ["06:40", 6.667], ["400 min", 6.667], [24000, 6.667], [400, 6.667], [6.5, 6.5], ["24000 s", 6.667]] as const) {
  check(`sleep duration ${JSON.stringify(input)}`, near(parseDurationHours(input), hours, 0.01), `got ${parseDurationHours(input)}`);
}
check("shortcut JSON: 'sleep' key accepts a duration string", near(parseSimpleJson({ sleep: "7 hr 12 min" }).days[0].sleepHours, 7.2));

// 4. Health Auto Export.
const hae = {
  data: {
    metrics: [
      { name: "step_count", units: "count", data: [{ date: "2026-09-14 00:00:00 +0530", qty: 9120 }] },
      { name: "active_energy", units: "kJ", data: [{ date: "2026-09-14 00:00:00 +0530", qty: 2510.4 }] },
      { name: "sleep_analysis", units: "hr", data: [{ date: "2026-09-14 00:00:00 +0530", totalSleep: 6.9, inBed: 7.6, core: 3.9, deep: 1.2, rem: 1.8 }] },
      { name: "weight_body_mass", units: "lb", data: [{ date: "2026-09-14 07:00:00 +0530", qty: 197.1 }] },
      { name: "resting_heart_rate", units: "count/min", data: [{ date: "2026-09-14 00:00:00 +0530", qty: 57 }] },
    ],
    workouts: [
      { id: "ABC-1", name: "Outdoor Run", start: "2026-09-14 18:00:00 +0530", end: "2026-09-14 18:30:00 +0530", duration: 1800, activeEnergyBurned: { qty: 310, units: "kcal" }, distance: { qty: 3.1, units: "mi" } },
    ],
  },
};
check("Health Auto Export detected", isHealthAutoExport(hae) && !isHealthAutoExport({ steps: 1 }));
const haeBatch = parseHealthAutoExport(hae);
const h0 = haeBatch.days.find((d) => d.date === "2026-09-14");
check("HAE: steps", h0?.steps === 9120);
check("HAE: kJ -> kcal", near(h0?.activeKcal, 600, 0.1), `got ${h0?.activeKcal}`);
check("HAE: totalSleep preferred over inBed", near(h0?.sleepHours, 6.9));
check("HAE: lb -> kg", near(h0?.weightKg, 89.4, 0.05), `got ${h0?.weightKg}`);
const hw = haeBatch.workouts[0];
check("HAE workout: duration from start/end, miles -> km", hw?.durationMin === 30 && near(hw?.distanceKm, 4.99, 0.02) && hw.activity === "running", JSON.stringify(hw));

// 5. CSV — quoted fields, units in headers, day-first dates.
const csv = `Date,Steps,"Sleep (min)",Active Calories,Distance (m),Weight (lb),Notes
2026-09-10,"10,204",420,512,7400,198.0,"felt good, slept ok"
15/09/2026,8800,390,,6100,,
not a date,1,1,1,1,1,
`;
const csvBatch = parseHealthCsv(csv, "Health Connect");
check("CSV: rows with a bad date skipped", csvBatch.days.length === 2, `got ${csvBatch.days.length}`);
const c0 = csvBatch.days[0];
check("CSV: quoted '10,204'", c0.steps === 10204, `got ${c0.steps}`);
check("CSV: sleep minutes from header unit", c0.sleepHours === 7);
check("CSV: distance metres from header unit", near(c0.distanceKm, 7.4));
check("CSV: weight lb from header unit", near(c0.weightKg, 89.8, 0.05), `got ${c0.weightKg}`);
check("CSV: day-first date 15/09/2026", csvBatch.days[1].date === "2026-09-15");
let csvError = "";
try { parseHealthCsv("steps,sleep\n1,2"); } catch (e) { csvError = (e as Error).message; }
check("CSV: missing date column explained", /date column/.test(csvError));

// 6. Sanitising impossible values.
check("sanitise: impossible values dropped", sanitiseDay({ date: "2026-09-15", steps: -5, restingHr: 400, weightKg: 89 })?.steps === undefined && sanitiseDay({ date: "2026-09-15", restingHr: 400, weightKg: 89 })?.restingHr === undefined);
check("sanitise: a day with nothing valid is discarded", sanitiseDay({ date: "2026-09-15", steps: -1 }) === null);
check("sanitise: zero active energy and sleep mean not measured", (() => {
  const d = sanitiseDay({ date: "2026-09-15", steps: 763, activeKcal: 0, sleepHours: 0 });
  return d?.steps === 763 && d.activeKcal === undefined && d.sleepHours === undefined;
})());

console.log(`${passed}/${passed + failures.length} health parsing tests passed`);
if (failures.length) {
  console.log("\nFailures:\n" + failures.join("\n"));
  process.exit(1);
}
