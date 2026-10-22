import "server-only";
import sharp from "sharp";
import { saveFood } from "./foods";
import { nutritionFor } from "./parser";
import { createEntry } from "./tracker";
import { estimateFromPhoto, type AiConfig } from "./ai";

/** Plenty for recognising food, and small enough to send quickly. */
const MAX_EDGE = 1024;

export type PhotoResult = { added: number; kcal: number; dish?: string; names: string[]; note?: string; error?: string };

/**
 * Whatever the phone sent — a 48-megapixel camera original, a PNG screenshot,
 * a photo lying on its side — becomes an upright JPEG of at most 1024 px.
 * A 12 MB photo comes out around 100-200 KB, which is what keeps the AI call fast.
 */
export async function compressPhoto(bytes: Buffer) {
  try {
    const out = await sharp(bytes, { failOn: "none", sequentialRead: true })
      .rotate() // honour the camera's EXIF orientation before it is stripped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // transparent screenshots would turn black
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    throw new Error(
      "That photo could not be read. If it is HEIC, set Settings → Camera → Formats to Most Compatible, or send a screenshot of it."
    );
  }
}

/** Feature: photograph a plate and have it logged. */
export async function logPhoto(
  userId: string,
  ai: AiConfig,
  input: { image: string; meal: string; date: string; hint?: string }
): Promise<PhotoResult> {
  const result = await estimateFromPhoto(ai, input.image, input.hint);
  if (!result.items?.length) {
    return { added: 0, kcal: 0, names: [], note: result.note || "No food was recognised in that photo." };
  }

  let kcal = 0;
  const names: string[] = [];

  for (const item of result.items) {
    const grams = Number(item.grams) || 100;
    const scale = 100 / grams; // the model gives totals for the portion; store per 100 g
    const food = await saveFood(
      userId,
      {
        name: item.name,
        aliases: [],
        kcal: (Number(item.kcal) || 0) * scale,
        protein: (Number(item.protein) || 0) * scale,
        carbs: (Number(item.carbs) || 0) * scale,
        fat: (Number(item.fat) || 0) * scale,
        units: [{ name: item.unit || "serving", grams: grams / (Number(item.quantity) || 1) }, { name: "g", grams: 1 }],
        cuisine: "other",
        tags: ["photo"],
      },
      "vision"
    );

    const nutrition = nutritionFor(food, Number(item.quantity) || 1, item.unit || null);
    await createEntry(userId, {
      date: input.date,
      meal: input.meal,
      rawText: `📷 ${item.name}`,
      food,
      quantity: Number(item.quantity) || 1,
      nutrition,
      source: "vision",
    });
    kcal += nutrition.kcal;
    names.push(food.name);
  }

  return { added: names.length, kcal: Math.round(kcal), dish: result.dish, names, note: result.note };
}
