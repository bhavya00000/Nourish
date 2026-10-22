// The AI providers users can choose from. Everything except Anthropic speaks
// the OpenAI chat-completions shape, so one adapter covers most of them.

export type ProviderId = "groq" | "openai" | "anthropic" | "google" | "openrouter" | "custom";

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  /** Anthropic uses its own Messages API; everything else is OpenAI-shaped. */
  wire: "openai" | "anthropic";
  baseUrl: string;
  keysUrl: string;
  keyHint: string;
  free?: string;
  models: { id: string; label: string; vision?: boolean; note?: string }[];
  defaultModel: string;
  defaultVisionModel: string;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "groq",
    label: "Groq",
    wire: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keysUrl: "https://console.groq.com/keys",
    keyHint: "gsk_…",
    free: "Generous free tier — a good default if you are not paying for AI.",
    defaultModel: "openai/gpt-oss-120b",
    defaultVisionModel: "qwen/qwen3.8-27b",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "Best quality on Groq" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Faster, cheaper" },
      { id: "qwen/qwen3.8-27b", label: "Qwen3.8 27B", vision: true, note: "Reads photos" },
      { id: "qwen/qwen3.6-27b", label: "Qwen3.6 27B", vision: true },
      { id: "groq/compound", label: "Groq Compound" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", note: "If your key has it" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    wire: "openai",
    baseUrl: "https://api.openai.com/v1",
    keysUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
    defaultModel: "gpt-4o-mini",
    defaultVisionModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", vision: true, note: "Cheap and capable" },
      { id: "gpt-4o", label: "GPT-4o", vision: true },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", vision: true },
      { id: "gpt-4.1", label: "GPT-4.1", vision: true },
      { id: "o4-mini", label: "o4-mini", note: "Reasoning" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    wire: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keysUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-…",
    defaultModel: "claude-sonnet-5",
    defaultVisionModel: "claude-sonnet-5",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", vision: true, note: "Balanced" },
      { id: "claude-opus-5", label: "Claude Opus 5", vision: true, note: "Most capable" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", vision: true, note: "Fastest" },
    ],
  },
  {
    id: "google",
    label: "Google Gemini",
    wire: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keysUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza…",
    free: "Has a free tier through AI Studio.",
    defaultModel: "gemini-2.0-flash",
    defaultVisionModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", vision: true },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", vision: true },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", vision: true },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    wire: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keysUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-…",
    free: "One key for many models, including free ones.",
    defaultModel: "google/gemini-2.0-flash-001",
    defaultVisionModel: "google/gemini-2.0-flash-001",
    models: [
      { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", vision: true },
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini", vision: true },
      { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", vision: true },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    ],
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    wire: "openai",
    baseUrl: "",
    keysUrl: "",
    keyHint: "optional",
    free: "Anything that speaks the OpenAI API — Ollama, LM Studio, vLLM, Together, DeepSeek.",
    defaultModel: "",
    defaultVisionModel: "",
    models: [],
  },
];

export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

/** What the settings page needs, without leaking anything sensitive. */
export const PROVIDER_OPTIONS = PROVIDERS.map((p) => ({
  id: p.id,
  label: p.label,
  keysUrl: p.keysUrl,
  keyHint: p.keyHint,
  free: p.free ?? null,
  models: p.models,
  defaultModel: p.defaultModel,
  defaultVisionModel: p.defaultVisionModel,
  needsBaseUrl: p.id === "custom",
}));
