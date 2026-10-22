import "server-only";
import { getProvider, type ProviderInfo } from "./providers";
import { closeTruncatedJson } from "./json-repair";

// The AI layer. Each user picks a provider and model and supplies their own
// key; the server's own key (if any) is only a fallback.

export type AiConfig = {
  provider: ProviderInfo;
  apiKey: string;
  model: string;
  visionModel: string;
  baseUrl: string;
  /** True when the request is running on the server's key rather than the user's. */
  usingServerKey: boolean;
};

/** The server's own credentials, used when a user has not set their own. */
export function serverConfig(): AiConfig | null {
  if (!process.env.GROQ_API_KEY) return null;
  const provider = getProvider("groq");
  return {
    provider,
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || provider.defaultModel,
    visionModel: process.env.GROQ_VISION_MODEL || provider.defaultVisionModel,
    baseUrl: process.env.GROQ_BASE_URL || provider.baseUrl,
    usingServerKey: true,
  };
}

export const serverKeyAvailable = () => Boolean(process.env.GROQ_API_KEY);

/**
 * Reasoning models (gpt-oss, qwen3, deepseek-r1, o-series) think before
 * answering. The hidden reasoning eats the token budget, and OpenAI-style
 * json_object mode sees an empty visible answer and rejects it. For these we
 * ask for JSON as plain text and parse it ourselves.
 */
const isReasoningModel = (model: string) => /gpt-oss|qwen3|deepseek-r1|reasoning|^o\d|thinking/i.test(model);

/** Pull a JSON object out of a reply that may be fenced or wrapped in prose. */
function extractJson<T>(raw: string): T {
  const text = cleanReply(raw);

  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    if (start === -1) throw new Error("The AI reply did not contain any JSON.");
    const end = text.lastIndexOf("}");
    if (end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        /* fall through to salvaging a cut-off reply */
      }
    }
    const salvaged = closeTruncatedJson(text.slice(start));
    if (salvaged) return JSON.parse(salvaged) as T;
    throw new Error("The AI reply was not valid JSON.");
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Providers report how long to wait; fall back to a short backoff if not. */
function retryDelay(body: string, header: string | null, attempt: number) {
  const fromHeader = Number(header);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.min(fromHeader * 1000, 15_000);

  const match = body.match(/try again in ([\d.]+)(ms|s)/i);
  if (match) {
    const value = Number(match[1]);
    return Math.min(match[2].toLowerCase() === "s" ? value * 1000 : value, 15_000) + 250;
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type Message = { role: "system" | "user"; content: string | Part[] };

function endpoint(config: AiConfig) {
  const base = (config.baseUrl || config.provider.baseUrl).replace(/\/+$/, "");
  return config.provider.wire === "anthropic" ? `${base}/messages` : `${base}/chat/completions`;
}

function headers(config: AiConfig): Record<string, string> {
  if (config.provider.wire === "anthropic") {
    return {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
  }
  return { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" };
}

/** Translate our OpenAI-shaped messages into Anthropic's Messages API. */
function toAnthropicBody(messages: Message[], model: string, maxTokens: number, temperature: number) {
  const system = messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n\n");

  const content = messages
    .filter((m) => m.role === "user")
    .flatMap((m) => {
      if (typeof m.content === "string") return [{ type: "text", text: m.content }];
      return m.content.map((part) => {
        if (part.type === "text") return { type: "text", text: part.text };
        const [meta, data] = part.image_url.url.split(",");
        const mediaType = meta.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
        return { type: "image", source: { type: "base64", media_type: mediaType, data } };
      });
    });

  return { model, max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages: [{ role: "user", content }] };
}

async function post(config: AiConfig, body: Record<string, unknown>) {
  // Rate limits and brief capacity problems are "try again shortly", not
  // failures, and providers ask for a backoff.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint(config), {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    const text = await res.text();
    const transient = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!transient || attempt >= 3) return { ok: res.ok, status: res.status, text };
    await sleep(retryDelay(text, res.headers.get("retry-after"), attempt));
  }
}

function readContent(config: AiConfig, payload: Record<string, unknown>) {
  if (config.provider.wire === "anthropic") {
    const blocks = (payload.content ?? []) as { type: string; text?: string }[];
    return {
      content: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
      finishReason: String(payload.stop_reason ?? ""),
    };
  }
  const choice = (payload.choices as { finish_reason?: string; message?: { content?: string } }[])?.[0];
  return { content: choice?.message?.content ?? "", finishReason: String(choice?.finish_reason ?? "") };
}

async function chat<T>(
  config: AiConfig | null,
  messages: Message[],
  { json = false, temperature = 0.4, maxTokens = 900, vision = false, exactTokens = false, retried = false } = {}
): Promise<T> {
  if (!config?.apiKey) {
    throw new Error("No AI key configured. Add your own in Settings, or set GROQ_API_KEY on the server.");
  }

  const model = (vision ? config.visionModel : config.model) || config.provider[vision ? "defaultVisionModel" : "defaultModel"];
  if (!model) throw new Error("No model selected. Choose one in Settings.");

  const reasoning = isReasoningModel(model);
  const anthropic = config.provider.wire === "anthropic";

  // Reasoning tokens come from the same budget, so give those models room --
  // unless the caller opted out, because some providers reject a requested
  // budget larger than their per-minute allowance.
  const budget = reasoning && !exactTokens ? Math.max(maxTokens * 3, 2500) : maxTokens;

  const base: Record<string, unknown> = anthropic
    ? toAnthropicBody(messages, model, budget, temperature)
    : {
        model,
        messages,
        temperature,
        max_tokens: budget,
        ...(reasoning && config.provider.id === "groq" ? { reasoning_effort: "low" } : {}),
      };

  // JSON mode is an OpenAI-shape feature, and unreliable on reasoning models.
  const useJsonMode = json && !anthropic && !reasoning;
  const first = useJsonMode ? { ...base, response_format: { type: "json_object" } } : base;

  let attempt = await post(config, first);

  // Some models reject their own output in JSON mode; retry as plain text.
  if (!attempt.ok && useJsonMode && /json_validate_failed|response_format|json_object/i.test(attempt.text)) {
    attempt = await post(config, base);
  }

  if (!attempt.ok) {
    let detail = attempt.text.slice(0, 300);
    try {
      const parsed = JSON.parse(attempt.text);
      detail = parsed.error?.message || parsed.message || detail;
    } catch {
      /* keep the raw body */
    }

    if (attempt.status === 401 || attempt.status === 403) {
      detail = `${config.provider.label} rejected the API key. Check it in Settings.`;
    } else if (attempt.status === 404 || /model_not_found|decommissioned|does not exist|not found/i.test(detail)) {
      detail = `"${model}" is not available on your ${config.provider.label} key. Pick a different model in Settings.`;
    } else if (attempt.status === 429) {
      detail = `${config.provider.label} is rate limiting your key. Wait a minute and try again.`;
    } else if (attempt.status >= 500) {
      detail = `${config.provider.label} is temporarily over capacity for "${model}". Try again shortly.`;
    } else {
      detail = `${config.provider.label} request failed (${attempt.status}): ${detail}`;
    }
    throw new Error(detail);
  }

  const { content, finishReason } = readContent(config, JSON.parse(attempt.text));
  const truncated = finishReason === "length" || finishReason === "max_tokens";

  // Reasoning models spend the budget thinking and can be cut off mid-answer;
  // one retry with more room usually gets the whole reply.
  const retry = () =>
    chat<T>(config, messages, { json, temperature, maxTokens: Math.min(budget * 3, 6000), vision, exactTokens: true, retried: true });

  if (!content.trim()) {
    if (truncated && !retried) return retry();
    const reason = truncated ? "it ran out of tokens before answering" : "it returned an empty reply";
    throw new Error(`"${model}" gave no answer (${reason}). Try a different model in Settings.`);
  }
  if (!json) return content as unknown as T;

  try {
    return JSON.parse(stripToJson(content)) as T;
  } catch {
    if (truncated && !retried) return retry();
  }
  try {
    return extractJson<T>(content);
  } catch {
    throw new Error(
      truncated
        ? `"${model}" ran out of room before finishing its answer. Try again, or pick a different model in Settings.`
        : `"${model}" replied in a form that could not be read. Try again, or pick a different model in Settings.`
    );
  }
}

/** The reply with any reasoning and code fences removed. */
function cleanReply(raw: string) {
  return String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** Just the outermost object, ready to parse. */
function stripToJson(raw: string) {
  const text = cleanReply(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}

// ---------------------------------------------------------------- features

export type FoodEstimate = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  unit_name: string;
  unit_grams: number;
  veg: boolean;
  cuisine: string;
  confidence: "high" | "medium" | "low";
};

const ESTIMATE_SYSTEM =
  "You are a nutrition database. Reply with JSON only: " +
  '{"name":string,"kcal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,' +
  '"sodium":number,"unit_name":string,"unit_grams":number,"veg":boolean,"cuisine":string,' +
  '"confidence":"high"|"medium"|"low"}. ' +
  "kcal, protein, carbs, fat, fiber and sugar are grams per 100 g of the food as normally eaten (cooked if it is " +
  "a cooked dish); sodium is milligrams per 100 g. unit_name is the most natural household serving " +
  "(piece, katori, cup, glass, plate, slice, bowl, g) and unit_grams is the weight of ONE such serving. " +
  "Use Indian household portions where relevant. Give your best estimate for any real food; " +
  'if the text is not a food at all, set confidence to "low" and kcal to 0.';

/** Estimate nutrition for a food the built-in database does not know. */
export function estimateFood(config: AiConfig | null, description: string) {
  return chat<FoodEstimate>(
    config,
    [
      { role: "system", content: ESTIMATE_SYSTEM },
      { role: "user", content: String(description).slice(0, 200) },
    ],
    { json: true, temperature: 0.1, maxTokens: 400 }
  );
}

export type ExerciseEstimate = {
  name: string;
  category: "push" | "pull" | "legs" | "core" | "cardio" | "mobility" | "full";
  muscles: string[];
  equipment: string;
  is_cardio: boolean;
  met: number;
  confidence: "high" | "medium" | "low";
};

/** Classify a movement the exercise library does not know. */
export function estimateExercise(config: AiConfig | null, description: string) {
  return chat<ExerciseEstimate>(
    config,
    [
      {
        role: "system",
        content:
          "You classify strength and cardio exercises. Reply with JSON only: " +
          '{"name":string,"category":"push"|"pull"|"legs"|"core"|"cardio"|"mobility"|"full",' +
          '"muscles":[string],"equipment":string,"is_cardio":boolean,"met":number,' +
          '"confidence":"high"|"medium"|"low"}. ' +
          "met is the metabolic equivalent for the movement performed at a typical training intensity " +
          "(3-4 for isolation work, 5-7 for compound lifts, 7-11 for hard cardio). " +
          'If the text is not an exercise, set confidence to "low".',
      },
      { role: "user", content: String(description).slice(0, 200) },
    ],
    { json: true, temperature: 0.1, maxTokens: 300 }
  );
}

export type VisionResult = {
  items: { name: string; quantity: number; unit: string; grams: number; kcal: number; protein: number; carbs: number; fat: number }[];
  dish?: string;
  confidence: "high" | "medium" | "low";
  note?: string;
};

/** Identify the food in a photo and estimate the portion on the plate. */
export function estimateFromPhoto(config: AiConfig | null, dataUrl: string, hint?: string) {
  return chat<VisionResult>(
    config,
    [
      {
        role: "system",
        content:
          "You identify food in photographs and estimate portions. Reply with JSON only: " +
          '{"dish":string,"items":[{"name":string,"quantity":number,"unit":string,"grams":number,' +
          '"kcal":number,"protein":number,"carbs":number,"fat":number}],"confidence":"high"|"medium"|"low","note":string}. ' +
          "List each distinct food on the plate separately. `grams` is the estimated weight of that portion as " +
          "shown, and kcal/protein/carbs/fat are the totals for that portion (not per 100 g). " +
          "Use everyday units (piece, katori, cup, plate, slice, bowl, g). Use Indian household portions where " +
          "relevant. If no food is visible, return an empty items array and explain in `note`.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: hint ? `Photo of my meal. Context: ${hint}` : "What food is in this photo, and roughly how much?" },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    // A plate of food is a short JSON reply, and some providers cap the
    // requested output tokens, so ask for exactly what we need.
    { json: true, temperature: 0.2, maxTokens: 900, vision: true, exactTokens: true }
  );
}

export type MealSuggestion = {
  headline: string;
  options: { name: string; items: string[]; kcal: number; protein: number; why: string }[];
  tip: string;
};

/** Suggest what to eat next, given what is left in the day's budget. */
export function suggestMeal(config: AiConfig | null, context: unknown) {
  return chat<MealSuggestion>(
    config,
    [
      {
        role: "system",
        content:
          "You are a practical diet coach for everyday home cooking. Reply with JSON only: " +
          '{"headline":string,"options":[{"name":string,"items":[string],"kcal":number,"protein":number,"why":string}],"tip":string}. ' +
          "Give exactly 3 options. `items` are portion-explicit lines the user could log verbatim, " +
          'e.g. "2 roti", "1 katori dal", "150 g chicken curry". ' +
          "Respect the diet type, cuisines, allergies and dislikes given. Fit the remaining calories within about " +
          "15% and prioritise hitting the remaining protein. Keep to ordinary, easily available foods. " +
          "If the user trained today, account for it.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
    { json: true, temperature: 0.6, maxTokens: 1200 }
  );
}

export type Insight = { summary: string; wins: string[]; fixes: string[]; focus: string };

export function weeklyInsight(config: AiConfig | null, context: unknown) {
  return chat<Insight>(
    config,
    [
      {
        role: "system",
        content:
          "You are a coach reviewing a user's food and training log. Reply with JSON only: " +
          '{"summary":string,"wins":[string],"fixes":[string],"focus":string}. ' +
          "Be specific and quantitative, referencing their actual numbers, and connect nutrition to training " +
          "where the data supports it. 2-4 items in each list. Encouraging but honest. " +
          "Never give medical advice; suggest a doctor or dietitian for medical concerns.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
    { json: true, temperature: 0.5, maxTokens: 900 }
  );
}

export type DayPlan = {
  total_kcal: number;
  total_protein: number;
  meals: { meal: string; items: string[]; kcal: number; protein: number }[];
  notes: string;
};

export function dayPlan(config: AiConfig | null, context: unknown) {
  return chat<DayPlan>(
    config,
    [
      {
        role: "system",
        content:
          "You are a diet coach building a one-day meal plan. Reply with JSON only: " +
          '{"total_kcal":number,"total_protein":number,"meals":[{"meal":"breakfast"|"lunch"|"snacks"|"dinner",' +
          '"items":[string],"kcal":number,"protein":number}],"notes":string}. ' +
          '`items` must be portion-explicit lines the user can log verbatim, e.g. "3 roti", "1 katori dal", "200 g curd". ' +
          "Hit the calorie target within 5% and meet the protein target. Respect diet type, cuisines, allergies and dislikes.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
    { json: true, temperature: 0.5, maxTokens: 1800 }
  );
}

export type TrainingPlan = {
  split: string;
  rationale: string;
  days: { day: string; focus: string; exercises: string[]; cardio?: string; notes?: string }[];
  cardio_guidance: string;
  progression: string;
};

/** Build a weekly training split around the user's goal, days and equipment. */
export function trainingPlan(config: AiConfig | null, context: unknown) {
  return chat<TrainingPlan>(
    config,
    [
      {
        role: "system",
        content:
          "You are a strength and conditioning coach. Reply with JSON only: " +
          '{"split":string,"rationale":string,"days":[{"day":string,"focus":string,"exercises":[string],' +
          '"cardio":string,"notes":string}],"cardio_guidance":string,"progression":string}. ' +
          "Produce exactly one entry in `days` per training day the user has available, plus rest days marked " +
          'with focus "Rest". Each string in `exercises` must be loggable verbatim in the form ' +
          '"Exercise 3x8" or "Exercise 4x6 @60kg" — sets x reps, optional weight. `cardio` is a line like ' +
          '"Cycling 20 min". Match the user\'s equipment and experience, and set the volume against their ' +
          "calorie goal: less volume in a deep deficit, more when eating at maintenance or a surplus.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
    { json: true, temperature: 0.5, maxTokens: 2000 }
  );
}

export type WorkoutAdvice = {
  headline: string;
  suggestion: string;
  exercises: string[];
  cardio: string;
  fuelling: string;
};

/** "What should I train today?", aware of what they have already trained and eaten. */
export function suggestWorkout(config: AiConfig | null, context: unknown) {
  return chat<WorkoutAdvice>(
    config,
    [
      {
        role: "system",
        content:
          "You are a strength and conditioning coach. Reply with JSON only: " +
          '{"headline":string,"suggestion":string,"exercises":[string],"cardio":string,"fuelling":string}. ' +
          'Each string in `exercises` must be loggable verbatim as "Exercise 3x8" or "Exercise 4x6 @60kg". ' +
          "Use what they trained in the last week to pick the muscle groups that need work and to avoid " +
          "training the same group two days running. `fuelling` is one or two sentences on what to eat around " +
          "this session given their remaining calories and protein today.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
    { json: true, temperature: 0.55, maxTokens: 1100 }
  );
}
