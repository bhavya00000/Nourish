"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { getProvider } from "@/lib/providers";
import { aiSettingsFor, configFor } from "@/lib/ai-config";
import { estimateFood, type AiConfig } from "@/lib/ai";

const schema = z.object({
  provider: z.enum(["groq", "openai", "anthropic", "google", "openrouter", "custom"]),
  model: z.string().trim().max(120).default(""),
  visionModel: z.string().trim().max(120).default(""),
  baseUrl: z.string().trim().max(300).default(""),
  /** Absent means "leave the stored key alone"; an empty string clears it. */
  apiKey: z.string().trim().max(300).optional(),
});

export async function getAiSettings() {
  const user = await requireUser();
  return aiSettingsFor(user.id);
}

export async function saveAiSettingsAction(input: unknown) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { provider, model, visionModel, baseUrl, apiKey } = parsed.data;
  if (provider === "custom" && apiKey !== undefined && !baseUrl) {
    return { error: "A custom provider needs a base URL, e.g. http://localhost:11434/v1" };
  }

  const data: Record<string, string> = { provider, model, visionModel, baseUrl };
  if (apiKey !== undefined) data.apiKeyEnc = apiKey ? encryptSecret(apiKey) : "";

  await prisma.aiSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearAiKeyAction() {
  const user = await requireUser();
  await prisma.aiSetting.updateMany({ where: { userId: user.id }, data: { apiKeyEnc: "" } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Make a real call so a wrong key or an unavailable model is caught here,
 * rather than the first time the user tries to log an unusual food.
 */
export async function testAiAction(input?: { provider?: string; model?: string; visionModel?: string; baseUrl?: string; apiKey?: string }) {
  const user = await requireUser();

  let config: AiConfig | null;
  if (input?.apiKey) {
    // Test what is on screen, before it is saved.
    const provider = getProvider(input.provider ?? "groq");
    config = {
      provider,
      apiKey: input.apiKey,
      model: input.model || provider.defaultModel,
      visionModel: input.visionModel || input.model || provider.defaultVisionModel,
      baseUrl: provider.id === "custom" ? input.baseUrl || provider.baseUrl : provider.baseUrl,
      usingServerKey: false,
    };
  } else if (input?.provider) {
    // Test the saved key against possibly-changed model choices.
    const saved = await prisma.aiSetting.findUnique({ where: { userId: user.id } });
    const key = saved ? decryptSecret(saved.apiKeyEnc) : "";
    if (!key) {
      config = await configFor(user.id);
    } else {
      const provider = getProvider(input.provider);
      config = {
        provider,
        apiKey: key,
        model: input.model || provider.defaultModel,
        visionModel: input.visionModel || input.model || provider.defaultVisionModel,
        baseUrl: provider.id === "custom" ? input.baseUrl || provider.baseUrl : provider.baseUrl,
        usingServerKey: false,
      };
    }
  } else {
    config = await configFor(user.id);
  }

  if (!config) return { error: "No key to test. Paste one above, or set GROQ_API_KEY on the server." };

  const started = Date.now();
  try {
    const result = await estimateFood(config, "1 plate misal pav");
    return {
      ok: true,
      ms: Date.now() - started,
      provider: config.provider.label,
      model: config.model,
      sample: `${result.name}: ${Math.round(result.kcal)} kcal/100 g, 1 ${result.unit_name} = ${Math.round(result.unit_grams)} g`,
      usingServerKey: config.usingServerKey,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The test call failed." };
  }
}
