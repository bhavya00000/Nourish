import "server-only";
import { prisma } from "./db";
import { decryptSecret, maskSecret } from "./crypto";
import { getProvider } from "./providers";
import { serverConfig, type AiConfig } from "./ai";

/**
 * Resolve which credentials a request should run on: the user's own provider
 * and key if they have set one, otherwise the server's (when it has one).
 */
export async function configFor(userId: string): Promise<AiConfig | null> {
  const setting = await prisma.aiSetting.findUnique({ where: { userId } });
  if (!setting) return serverConfig();

  const apiKey = decryptSecret(setting.apiKeyEnc);
  if (!apiKey) return serverConfig();

  const provider = getProvider(setting.provider);
  return {
    provider,
    apiKey,
    model: setting.model || provider.defaultModel,
    visionModel: setting.visionModel || setting.model || provider.defaultVisionModel,
    // A custom URL left over from an earlier "custom" choice must never receive
    // another provider's key.
    baseUrl: provider.id === "custom" ? setting.baseUrl || provider.baseUrl : provider.baseUrl,
    usingServerKey: false,
  };
}

export async function aiAvailableFor(userId: string) {
  return Boolean(await configFor(userId));
}

/** Everything the settings page needs, with the key masked rather than sent. */
export async function aiSettingsFor(userId: string) {
  const setting = await prisma.aiSetting.findUnique({ where: { userId } });
  const key = setting ? decryptSecret(setting.apiKeyEnc) : "";
  const server = serverConfig();

  return {
    provider: setting?.provider ?? "groq",
    model: setting?.model ?? "",
    visionModel: setting?.visionModel ?? "",
    baseUrl: setting?.baseUrl ?? "",
    hasKey: Boolean(key),
    maskedKey: maskSecret(key),
    serverKeyAvailable: Boolean(server),
    serverProvider: server ? server.provider.label : null,
    serverModel: server?.model ?? null,
    usingServerKey: !key && Boolean(server),
  };
}
