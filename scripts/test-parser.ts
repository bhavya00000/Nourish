// Regression test for the free-text parser. Run: npm test
import { interpret, type ParsedFood } from "../src/lib/parser.ts";
import { SEED_FOODS } from "../src/lib/foods-seed.ts";
import { closeTruncatedJson } from "../src/lib/json-repair.ts";

const FOODS: ParsedFood[] = SEED_FOODS.map((f, i) => ({
  id: String(i),
  name: f.name,
  aliases: f.aliases,
  kcal: f.kcal,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  units: f.units,
  veg: f.veg,
  cuisine: f.cuisine,
  tags: f.tags,
  source: "builtin",
}));

type Case = { input: string; expect: { name: string; qty: number; unit: string; kcal: number }[] };

const CASES: Case[] = [
  { input: "2 roti", expect: [{ name: "Roti / Chapati (whole wheat)", qty: 2, unit: "piece", kcal: 238 }] },
  { input: "1 katori dal", expect: [{ name: "Dal (toor/arhar, cooked tadka)", qty: 1, unit: "katori", kcal: 177 }] },
  { input: "200g paneer", expect: [{ name: "Paneer", qty: 200, unit: "g", kcal: 592 }] },
  { input: "paneer 200 gm", expect: [{ name: "Paneer", qty: 200, unit: "g", kcal: 592 }] },
  { input: "half plate rice", expect: [{ name: "Steamed Rice (cooked)", qty: 0.5, unit: "plate", kcal: 163 }] },
  { input: "a glass of milk", expect: [{ name: "Milk (toned)", qty: 1, unit: "glass", kcal: 145 }] },
  { input: "3 eggs", expect: [{ name: "Egg (whole, boiled)", qty: 3, unit: "piece", kcal: 233 }] },
  { input: "2 cup daal", expect: [{ name: "Dal (toor/arhar, cooked tadka)", qty: 2, unit: "cup", kcal: 566 }] },
  { input: "1 tsp ghee", expect: [{ name: "Ghee", qty: 1, unit: "tsp", kcal: 45 }] },
  { input: "1 scoop whey", expect: [{ name: "Whey Protein (scoop)", qty: 1, unit: "scoop", kcal: 117 }] },
  {
    input: "3 roti 1 katori dal and 1 bowl curd",
    expect: [
      { name: "Roti / Chapati (whole wheat)", qty: 3, unit: "piece", kcal: 356 },
      { name: "Dal (toor/arhar, cooked tadka)", qty: 1, unit: "katori", kcal: 177 },
      { name: "Curd / Dahi (full fat)", qty: 1, unit: "bowl", kcal: 196 },
    ],
  },
  {
    input: "1 cup rice 2 egg",
    expect: [
      { name: "Steamed Rice (cooked)", qty: 1, unit: "cup", kcal: 205 },
      { name: "Egg (whole, boiled)", qty: 2, unit: "piece", kcal: 155 },
    ],
  },
  { input: "½ katori rajma", expect: [{ name: "Rajma (kidney bean curry)", qty: 0.5, unit: "katori", kcal: 101 }] },
  { input: "1/2 cup rice", expect: [{ name: "Steamed Rice (cooked)", qty: 0.5, unit: "cup", kcal: 103 }] },
  { input: "2 slice bread", expect: [{ name: "Bread (white)", qty: 2, unit: "slice", kcal: 148 }] },
  { input: "chai", expect: [{ name: "Tea with milk & sugar", qty: 1, unit: "cup", kcal: 98 }] },
];

let passed = 0;
const failures: string[] = [];

for (const testCase of CASES) {
  const got = interpret(testCase.input, FOODS);
  const problems: string[] = [];

  if (got.length !== testCase.expect.length) {
    problems.push(`expected ${testCase.expect.length} items, got ${got.length}`);
  }
  testCase.expect.forEach((want, i) => {
    const item = got[i];
    if (!item?.matched) return problems.push(`item ${i}: no match for "${item?.query ?? "?"}"`);
    if (item.food!.name !== want.name) problems.push(`item ${i}: matched "${item.food!.name}", wanted "${want.name}"`);
    if (item.quantity !== want.qty) problems.push(`item ${i}: quantity ${item.quantity}, wanted ${want.qty}`);
    if (item.nutrition!.unit !== want.unit) problems.push(`item ${i}: unit "${item.nutrition!.unit}", wanted "${want.unit}"`);
    if (Math.abs(item.nutrition!.kcal - want.kcal) > 2) problems.push(`item ${i}: ${item.nutrition!.kcal} kcal, wanted ${want.kcal}`);
  });

  if (problems.length) {
    failures.push(`  "${testCase.input}"\n    ${problems.join("\n    ")}`);
  } else {
    passed++;
  }
}

// Things that genuinely are not in the database must report as unmatched, so
// the app knows to fall back to the AI rather than guessing.
const unknown = interpret("1 plate zorbaflex special", FOODS);
if (unknown.every((i) => !i.matched)) passed++;
else failures.push('  "1 plate zorbaflex special" should not match anything');

// Confidence has to separate genuine matches from look-alikes, because that
// gap is what decides whether an entry is logged directly or sent to the AI.
const AUTO_ACCEPT = 0.75;
const confidenceOf = (text: string) => interpret(text, FOODS)[0]?.confidence ?? 0;

const mustBeConfident = ["2 roti", "1 katori dal", "200g paneer", "chai", "2 cup rice", "1 scoop whey", "masala dosa", "banana"];
const mustNotBeConfident = ["1 plate misal pav", "2 keema samosa", "shakshuka", "poke bowl", "sushi roll", "1 katori undhiyu"];

const tooLow = mustBeConfident.filter((t) => confidenceOf(t) < AUTO_ACCEPT);
const tooHigh = mustNotBeConfident.filter((t) => confidenceOf(t) >= AUTO_ACCEPT);

if (!tooLow.length && !tooHigh.length) passed++;
else {
  failures.push(
    "  confidence threshold:" +
      (tooLow.length ? `\n    real foods scoring below ${AUTO_ACCEPT}: ${tooLow.join(", ")}` : "") +
      (tooHigh.length ? `\n    unknown foods scoring at or above ${AUTO_ACCEPT}: ${tooHigh.join(", ")}` : "")
  );
}

// A photo reply cut off by the token limit still holds every item before the
// cut; it must be salvaged rather than fail with "Expected ',' or ']'".
const cutOff = `{
  "dish": "Dal chawal",
  "items": [
    {"name": "Roti", "quantity": 2, "unit": "piece", "grams": 80, "kcal": 240},
    {"name": "Dal {tadka}", "quantity": 1, "unit": "katori", "grams": 150, "kcal": 180},
    {"name": "Sal`;
const salvaged = closeTruncatedJson(cutOff);
const salvagedNames = salvaged ? (JSON.parse(salvaged).items as { name: string }[]).map((i) => i.name).join(", ") : "";
if (salvagedNames === "Roti, Dal {tadka}" && closeTruncatedJson('{"dish": "Da') === null) passed++;
else failures.push(`  cut-off AI reply: salvaged "${salvagedNames}", wanted "Roti, Dal {tadka}"`);

console.log(`${passed}/${CASES.length + 3} parser tests passed`);
if (failures.length) {
  console.log("\nFailures:\n" + failures.join("\n"));
  process.exit(1);
}
