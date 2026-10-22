// Turns what people actually type ("2 roti and a katori dal", "200g paneer",
// "half plate rice") into quantity + unit + a matched food.

export type ParsedFood = {
  id: string;
  name: string;
  aliases: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  units: { name: string; grams: number }[];
  veg: boolean;
  cuisine: string;
  tags: string[];
  source: string;
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
  half: 0.5, aadha: 0.5, quarter: 0.25, deadh: 1.5, dedh: 1.5,
};

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/** Every spelling we accept, mapped to the canonical unit used in the database. */
const UNIT_ALIASES: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg",
  ml: "ml", milliliter: "ml", millilitre: "ml", cc: "ml",
  l: "l", ltr: "l", litre: "l", liter: "l", litres: "l", liters: "l",
  cup: "cup", cups: "cup",
  katori: "katori", katoris: "katori", kathori: "katori", bowl: "bowl", bowls: "bowl",
  glass: "glass", glasses: "glass", tumbler: "glass",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", spoon: "tbsp", spoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", no: "piece", nos: "piece", unit: "piece",
  slice: "slice", slices: "slice",
  plate: "plate", plates: "plate", thali: "plate",
  scoop: "scoop", scoops: "scoop",
  handful: "handful", handfuls: "handful", mutthi: "handful",
  packet: "packet", packets: "packet", pack: "packet", sachet: "packet",
  bottle: "bottle", bottles: "bottle", can: "can", cans: "can", tin: "can",
  bar: "bar", bars: "bar", cube: "cube", cubes: "cube", peg: "peg", pegs: "peg",
  serving: "serving", servings: "serving",
};

/** Size words scale whatever the default serving is. */
const SIZE_FACTORS: Record<string, number> = {
  small: 0.7, chhota: 0.7, medium: 1, regular: 1, large: 1.4, big: 1.4, bada: 1.4, xl: 1.6, full: 1.2,
};

/** Used when the user names a unit the food itself does not define. */
const GENERIC_UNIT_GRAMS: Record<string, number> = {
  cup: 200, katori: 150, bowl: 200, glass: 250, tbsp: 15, tsp: 5,
  plate: 250, handful: 30, piece: 50, slice: 30, scoop: 30,
  packet: 50, bottle: 500, can: 330, bar: 40, cube: 15, peg: 30, serving: 100,
};

const FILLER = new Set([
  "of", "some", "i", "had", "ate", "eat", "with", "the", "my", "a", "an", "and",
  "plus", "also", "today", "morning", "evening", "night", "for", "in", "one",
]);

/** Expand "½" and friends before normalise() strips non-ASCII characters. */
function expandFractions(s: string) {
  let out = String(s || "");
  for (const [glyph, value] of Object.entries(FRACTIONS)) out = out.replaceAll(glyph, ` ${value} `);
  return out;
}

export function normalise(s: string) {
  return expandFractions(s).toLowerCase().replace(/[^a-z0-9\s/.+-]/g, " ").replace(/\s+/g, " ").trim();
}

const isQuantityToken = (t: string) =>
  /^\d+(\.\d+)?$/.test(t) || /^\d+\/\d+$/.test(t) || t in FRACTIONS ||
  (t in NUMBER_WORDS && t !== "a" && t !== "an");

/**
 * People run items together without punctuation ("3 roti 1 katori dal"), so a
 * fresh quantity appearing after a food word starts a new item.
 */
function splitCompound(chunk: string) {
  const tokens = normalise(chunk).split(" ").filter(Boolean);
  const out: string[] = [];
  let current: string[] = [];
  let sawFoodWord = false;
  let sawQuantity = false;

  for (const token of tokens) {
    // "3 roti 1 katori dal" -> split. "paneer 200 gm" -> keep together, because
    // that 200 is this item's quantity written after the name.
    if (isQuantityToken(token) && sawFoodWord && sawQuantity) {
      out.push(current.join(" "));
      current = [];
      sawFoodWord = false;
      sawQuantity = false;
    }
    if (isQuantityToken(token)) sawQuantity = true;
    current.push(token);
    if (!isQuantityToken(token) && !(token in UNIT_ALIASES) && !(token in SIZE_FACTORS) && !FILLER.has(token)) {
      sawFoodWord = true;
    }
  }
  if (current.length) out.push(current.join(" "));
  return out.filter(Boolean);
}

export function splitItems(text: string) {
  return String(text || "")
    .split(/\s*(?:,|;|\+|\n|\band\b|\bwith\b|&)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(splitCompound);
}

export type Phrase = { quantity: number; unit: string | null; sizeFactor: number; query: string };

export function parsePhrase(phrase: string): Phrase {
  let text = normalise(phrase);

  let quantity: number | null = null;
  let unit: string | null = null;
  let sizeFactor = 1;

  // "200g", "1.5kg", "250ml" written without a space.
  const glued = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|gms?|grams?|g|ml|l|litres?|liters?)(?=\s|$)/);
  if (glued) {
    quantity = Number(glued[1]);
    unit = UNIT_ALIASES[glued[2]];
    text = text.replace(glued[0], " ");
  }

  const rest: string[] = [];
  for (const token of text.split(" ").filter(Boolean)) {
    if (quantity === null) {
      const frac = token.match(/^(\d+)\/(\d+)$/);
      if (frac) { quantity = Number(frac[1]) / Number(frac[2]); continue; }
      if (/^\d+(\.\d+)?$/.test(token)) { quantity = Number(token); continue; }
      if (token in NUMBER_WORDS) { quantity = NUMBER_WORDS[token]; continue; }
    }
    if (!unit && token in UNIT_ALIASES) { unit = UNIT_ALIASES[token]; continue; }
    if (token in SIZE_FACTORS) { sizeFactor = SIZE_FACTORS[token]; continue; }
    if (FILLER.has(token) && rest.length === 0) continue;
    rest.push(token);
  }

  // Trailing quantity: "roti 2".
  if (quantity === null && rest.length > 1 && /^\d+(\.\d+)?$/.test(rest[rest.length - 1])) {
    quantity = Number(rest.pop());
  }

  return {
    quantity: quantity ?? 1,
    unit,
    sizeFactor,
    query: rest.filter((t) => !FILLER.has(t)).join(" ").trim() || normalise(phrase),
  };
}

// ---------------------------------------------------------------- matching

const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tokensOf = (s: string) => normalise(s).split(" ").filter(Boolean).map(singular);

function bigrams(s: string) {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient — cheap, and forgiving of the typos people actually make. */
function similarity(a: string, b: string) {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let hits = 0;
  for (const g of A) if (B.has(g)) hits++;
  return (2 * hits) / (A.size + B.size);
}

export function scoreFood(query: string, food: ParsedFood) {
  const q = normalise(query);
  if (!q) return 0;
  const qTokens = tokensOf(q);
  let best = 0;

  for (const raw of [food.name, ...(food.aliases || [])]) {
    const name = normalise(raw);
    if (name === q) return 1;
    const nameTokens = tokensOf(name);

    if (nameTokens.join(" ") === qTokens.join(" ")) return 0.99;
    if (nameTokens.includes(q) || qTokens.join(" ") === name) best = Math.max(best, 0.95);
    if (name.startsWith(q) && q.length >= 3) best = Math.max(best, 0.9);

    const covered = qTokens.filter((t) => nameTokens.some((n) => n === t || (t.length > 3 && n.startsWith(t)))).length;
    if (covered) {
      const coverage = covered / qTokens.length;
      const precision = covered / nameTokens.length;
      best = Math.max(best, 0.55 * coverage + 0.3 * precision);
    }
    best = Math.max(best, similarity(q, name) * 0.8);
  }
  // Tiebreak toward the plainer food: "paneer" should beat "paneer paratha".
  return best - Math.min(0.02, 0.004 * tokensOf(food.name).length);
}

export function searchFoods(query: string, foods: ParsedFood[], limit = 8) {
  return foods
    .map((food) => ({ food, score: scoreFood(query, food) }))
    .filter((r) => r.score > 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------- portions

export function resolveUnit(food: ParsedFood, unit: string | null, sizeFactor = 1) {
  const units = food.units?.length ? food.units : [{ name: "g", grams: 1 }];
  const chosen = unit || units[0].name;

  if (chosen === "kg" || chosen === "l") return { unit: chosen, grams: 1000 * sizeFactor, exact: true };

  const match = units.find((u) => u.name === chosen);
  if (match) return { unit: match.name, grams: match.grams * sizeFactor, exact: true };

  if (GENERIC_UNIT_GRAMS[chosen]) {
    return { unit: chosen, grams: GENERIC_UNIT_GRAMS[chosen] * sizeFactor, exact: false };
  }
  return { unit: units[0].name, grams: units[0].grams * sizeFactor, exact: false };
}

export type Nutrition = {
  unit: string;
  approximateUnit: boolean;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

export function nutritionFor(food: ParsedFood, quantity: number, unit: string | null, sizeFactor = 1): Nutrition {
  const resolved = resolveUnit(food, unit, sizeFactor);
  const grams = quantity * resolved.grams;
  const k = grams / 100;
  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    unit: resolved.unit,
    approximateUnit: !resolved.exact,
    grams: round(grams),
    kcal: Math.round(food.kcal * k),
    protein: round(food.protein * k),
    carbs: round(food.carbs * k),
    fat: round(food.fat * k),
    fiber: round((food.fiber ?? 0) * k),
    sugar: round((food.sugar ?? 0) * k),
    sodium: Math.round((food.sodium ?? 0) * k),
  };
}

export type Interpreted = {
  phrase: string;
  quantity: number;
  unit: string | null;
  sizeFactor: number;
  query: string;
  matched: boolean;
  confidence?: number;
  food?: ParsedFood;
  nutrition?: Nutrition;
  candidates: { id: string; name: string; score: number }[];
};

/** Full pipeline: one typed line to priced-up entries, plus anything unmatched. */
export function interpret(text: string, foods: ParsedFood[]): Interpreted[] {
  return splitItems(text).map((phrase) => {
    const parsed = parsePhrase(phrase);
    const matches = searchFoods(parsed.query, foods);

    if (!matches.length) return { phrase, ...parsed, matched: false, candidates: [] };

    const best = matches[0].food;
    return {
      phrase,
      ...parsed,
      matched: true,
      confidence: Number(matches[0].score.toFixed(2)),
      food: best,
      nutrition: nutritionFor(best, parsed.quantity, parsed.unit, parsed.sizeFactor),
      candidates: matches.slice(1, 6).map((m) => ({
        id: m.food.id,
        name: m.food.name,
        score: Number(m.score.toFixed(2)),
      })),
    };
  });
}

export function parseUnits(units: string) {
  return units.split("|").filter(Boolean).map((u) => {
    const [name, grams] = u.split(":");
    return { name, grams: Number(grams) };
  });
}

export const serialiseUnits = (units: { name: string; grams: number }[]) =>
  units.map((u) => `${u.name}:${u.grams}`).join("|");
