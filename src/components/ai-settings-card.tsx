"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Chip, Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { clearAiKeyAction, saveAiSettingsAction, testAiAction } from "@/actions/ai-settings";
import { PROVIDER_OPTIONS } from "@/lib/providers";

type Settings = {
  provider: string;
  model: string;
  visionModel: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  serverKeyAvailable: boolean;
  serverProvider: string | null;
  serverModel: string | null;
  usingServerKey: boolean;
};

type TestResult = { ok?: boolean; ms?: number; provider?: string; model?: string; sample?: string; usingServerKey?: boolean; error?: string };

export function AiSettingsCard({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();
  const [providerId, setProviderId] = useState(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [visionModel, setVisionModel] = useState(settings.visionModel);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [pending, startTransition] = useTransition();

  const provider = PROVIDER_OPTIONS.find((p) => p.id === providerId) ?? PROVIDER_OPTIONS[0];
  const visionCapable = provider.models.filter((m) => m.vision);

  function switchProvider(id: string) {
    const next = PROVIDER_OPTIONS.find((p) => p.id === id);
    setProviderId(id);
    // Carrying a model name across providers never works, so reset to theirs.
    setModel(next?.defaultModel ?? "");
    setVisionModel(next?.defaultVisionModel ?? "");
    setTest(null);
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-faint" />
            AI provider
          </span>
        }
        subtitle="Choose a model and use your own key. It is encrypted before it is stored and never sent to the browser."
      />
      <CardBody className="space-y-4">
        {settings.usingServerKey && (
          <Notice tone="warn">
            You are currently using this server&rsquo;s shared {settings.serverProvider} key
            {settings.serverModel ? ` (${settings.serverModel})` : ""}. Add your own below to stop sharing its rate
            limits.
          </Notice>
        )}
        {settings.hasKey && (
          <Notice>
            <span className="flex items-center gap-2 flex-wrap">
              <KeyRound className="size-3.5 shrink-0" />
              Using your own key <code className="font-mono text-[12px]">{settings.maskedKey}</code>
            </span>
          </Notice>
        )}
        {!settings.hasKey && !settings.serverKeyAvailable && (
          <Notice tone="warn">
            No AI key is configured, so food estimation, photo logging and the coaches are off. Everything else works
            normally.
          </Notice>
        )}

        <Field group label="Provider">
          <div className="flex flex-wrap gap-2">
            {PROVIDER_OPTIONS.map((option) => (
              <Chip key={option.id} active={providerId === option.id} onClick={() => switchProvider(option.id)}>
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>

        {provider.free && <p className="text-[12.5px] text-muted text-pretty">{provider.free}</p>}

        {provider.needsBaseUrl && (
          <Field label="Base URL" hint="Any OpenAI-compatible endpoint, e.g. http://localhost:11434/v1">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" />
          </Field>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Model" hint="Used for estimation, suggestions and coaching.">
            {provider.models.length ? (
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.note ? ` — ${m.note}` : ""}
                  </option>
                ))}
                <option value="">Custom…</option>
              </Select>
            ) : (
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model-id" />
            )}
          </Field>

          <Field label="Vision model" hint="Used for photo logging. Must be able to read images.">
            {visionCapable.length ? (
              <Select value={visionModel} onChange={(e) => setVisionModel(e.target.value)}>
                {visionCapable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value="">Same as model</option>
              </Select>
            ) : (
              <Input value={visionModel} onChange={(e) => setVisionModel(e.target.value)} placeholder="vision-model-id" />
            )}
          </Field>
        </div>

        {provider.models.length > 0 && !provider.models.some((m) => m.id === model) && (
          <Field label="Custom model id">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="provider/model-name" />
          </Field>
        )}

        <Field
          label="API key"
          hint={
            settings.hasKey
              ? "Leave blank to keep the key you already saved."
              : provider.keysUrl
                ? "Stored encrypted. Only ever used for your own requests."
                : "Leave blank if your endpoint does not need one."
          }
        >
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hasKey ? settings.maskedKey : provider.keyHint}
              autoComplete="off"
            />
            {provider.keysUrl && (
              <a
                href={provider.keysUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border text-[13px] text-muted hover:text-text hover:bg-surface-2 transition-colors whitespace-nowrap"
              >
                Get key <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </Field>

        {test && (
          <Notice tone={test.error ? "danger" : "info"}>
            {test.error ? (
              test.error
            ) : (
              <span className="flex items-start gap-2">
                <Check className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  {test.provider} answered in {test.ms} ms using <strong>{test.model}</strong>
                  {test.usingServerKey ? " (server key)" : ""}.<br />
                  <span className="text-muted">{test.sample}</span>
                </span>
              </span>
            )}
          </Notice>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          {settings.hasKey && (
            <Button
              variant="ghost"
              onClick={async () => {
                await clearAiKeyAction();
                toast("Key removed");
                router.refresh();
              }}
            >
              Remove key
            </Button>
          )}
          <Button
            variant="secondary"
            loading={testing}
            onClick={async () => {
              setTesting(true);
              setTest(null);
              const result = await testAiAction({
                provider: providerId,
                model,
                visionModel,
                baseUrl,
                ...(apiKey ? { apiKey } : {}),
              });
              setTesting(false);
              setTest(result);
            }}
          >
            Test connection
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveAiSettingsAction({
                  provider: providerId,
                  model,
                  visionModel,
                  baseUrl,
                  ...(apiKey ? { apiKey } : {}),
                });
                if (result?.error) return toast(result.error, "error");
                setApiKey("");
                toast("AI settings saved");
                router.refresh();
              })
            }
          >
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
