// Verifies GROQ_API_KEY and the configured models, and says exactly what failed.
// Run with: npm run check:ai
import "dotenv/config";
import { estimateFood, estimateFromPhoto, serverConfig, suggestMeal } from "../src/lib/ai.ts";

const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const visionModel = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

const config = serverConfig();
if (!config) {
  console.log("✗ GROQ_API_KEY is not set.");
  console.log("  Add it to .env (free key: https://console.groq.com/keys), then re-run.");
  console.log("  Individual users can also add their own key in Settings — this only checks the server key.");
  process.exit(1);
}

console.log(`Key found.\n  text model:   ${model}\n  vision model: ${visionModel}\n`);
let failures = 0;
let rateLimited = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isThrottled = (message: string) => /rate limit|over capacity|temporarily/i.test(message);

async function check(name: string, run: () => Promise<string>) {
  process.stdout.write(`  ${name} … `);
  const started = Date.now();
  try {
    const detail = await run();
    console.log(`ok (${Date.now() - started} ms) — ${detail}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A throttle is Groq's free tier being busy, not a broken configuration.
    if (isThrottled(message)) {
      rateLimited++;
      console.log(`rate limited\n    ${message}`);
    } else {
      failures++;
      console.log(`FAILED\n    ${message}`);
    }
  }
}

await check("food estimation", async () => {
  const r = await estimateFood(config, "1 plate misal pav");
  return `${r.name}: ${r.kcal} kcal/100 g, 1 ${r.unit_name} = ${r.unit_grams} g`;
});

// The free tier budgets output tokens per minute across the whole key, so
// pause between checks rather than throttling ourselves.
await sleep(2000);

await check("meal suggestion", async () => {
  const r = await suggestMeal(config, {
    profile: { sex: "male", weight_kg: 90, diet_type: "eggetarian", cuisines: "indian" },
    goal: { type: "lose", target_weight: 75 },
    meal: "dinner",
    remaining: { kcal: 600, protein: 70 },
  });
  return `${r.options?.length ?? 0} options, first: ${r.options?.[0]?.name ?? "?"}`;
});

await sleep(8000);

// A plain swatch is enough to prove the vision model accepts images at all;
// a wrong or text-only model id fails here rather than in front of a user.
await check("photo logging (vision model)", async () => {
  const swatch = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFElEQVR4nGOYRSJgGNUwqmH4agAAnH3OEDGpsA0AAAAASUVORK5CYII=";
  const r = await estimateFromPhoto(config, swatch, "test image, likely no food");
  return `model responded (${r.items?.length ?? 0} items recognised)`;
});

if (failures) {
  console.log(
    `\n${failures} check(s) failed. If a model returns nothing or invalid JSON, try a` +
      `\nnon-reasoning model:  GROQ_MODEL=llama-3.3-70b-versatile`
  );
} else if (rateLimited) {
  console.log(
    `\n${rateLimited} check(s) hit Groq's free-tier rate limit. The configuration is fine —` +
      `\nthe app retries automatically. Re-run in a minute to confirm.`
  );
} else {
  console.log("\nAll AI features are working.");
}
process.exit(failures ? 1 : 0);
