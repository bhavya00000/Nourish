"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Check, Copy, FileUp, HeartPulse, KeyRound, RefreshCw, Smartphone, Trash2, Watch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty, Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, SegmentedControl, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { clearHealthDataAction, createHealthTokenAction, revokeHealthTokenAction } from "@/actions/health";
import { cn, fmt, prettyDate } from "@/lib/utils";

type Token = { id: string; label: string; prefix: string; lastUsedAt: string | null; createdAt: string };
type Sync = { id: string; source: string; method: string; days: number; workouts: number; summary: string; error: string; createdAt: string };
type Latest = { date: string; healthSource: string; syncedAt: string | null; steps: number; sleepHours: number; activeKcal: number | null } | null;

function ago(iso: string | null) {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

export function HealthView({
  endpoint, host, tokens, syncs, syncedDays, syncedWorkouts, latest,
}: {
  endpoint: string;
  host: string;
  tokens: Token[];
  syncs: Sync[];
  syncedDays: number;
  syncedWorkouts: number;
  latest: Latest;
}) {
  const [platform, setPlatform] = useState<"iphone" | "android">("iphone");
  const [newToken, setNewToken] = useState<string | null>(null);
  const localOnly = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);

  return (
    <div className="space-y-4 animate-in">
      <header className="space-y-2">
        <Link href="/settings" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Health data</h1>
          <p className="text-[13px] text-muted mt-0.5 text-pretty">
            Bring in steps, sleep, active energy, heart rate, weight and workouts from your phone or watch.
          </p>
        </div>
      </header>

      <StatusCard latest={latest} syncedDays={syncedDays} syncedWorkouts={syncedWorkouts} />

      <Card>
        <CardHeader
          title="How it connects"
          subtitle="Why there are a couple of steps, and what they are"
        />
        <CardBody className="space-y-3 text-[13px] text-muted text-pretty">
          <p>
            Apple Health and Android&rsquo;s Health Connect only share data with apps installed on the phone — no
            website can read them directly. So your phone <strong className="text-text">sends</strong> the data here instead,
            to a private address that only accepts your personal token. Set it up once and it runs by itself.
          </p>
          <p>
            When a day has <strong className="text-text">active energy</strong> measured by a watch, it replaces the step
            and workout estimates for that day — a watch counts what estimates can only guess at.
          </p>
        </CardBody>
      </Card>

      {localOnly && (
        <Notice tone="warn">
          <span className="flex gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              You are viewing this at <code className="font-mono text-[12px]">{host}</code>, which your phone cannot
              reach. Open Nourish on your phone using this computer&rsquo;s Wi-Fi address (for example{" "}
              <code className="font-mono text-[12px]">http://192.168.1.20:3000</code>) and copy the sync address from there
              — or deploy Nourish somewhere with HTTPS, which iOS prefers.
            </span>
          </span>
        </Notice>
      )}

      <TokensCard tokens={tokens} onCreated={setNewToken} />

      <Card>
        <CardHeader title="Set up automatic sync" subtitle="Pick your phone" />
        <CardBody className="space-y-4">
          <SegmentedControl
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "iphone", label: <span className="inline-flex items-center gap-1.5"><Watch className="size-3.5" />iPhone &amp; Apple Watch</span> },
              { value: "android", label: <span className="inline-flex items-center gap-1.5"><Smartphone className="size-3.5" />Android</span> },
            ]}
          />
          <CopyRow label="Sync address" value={endpoint} />
          {newToken ? <CopyRow label="Your token" value={`Bearer ${newToken}`} secret /> : (
            <p className="text-[12.5px] text-muted">Create a token above — you will paste it into your phone as the Authorization header.</p>
          )}
          {platform === "iphone" ? <IphoneGuide endpoint={endpoint} /> : <AndroidGuide />}
        </CardBody>
      </Card>

      <ImportCard />
      <HistoryCard syncs={syncs} />
      <DangerCard hasData={syncedDays > 0 || syncedWorkouts > 0} />
    </div>
  );
}

function StatusCard({ latest, syncedDays, syncedWorkouts }: { latest: Latest; syncedDays: number; syncedWorkouts: number }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-start gap-3">
          <span className={cn("grid place-items-center size-10 rounded-xl shrink-0", latest ? "bg-kcal/12 text-kcal" : "bg-surface-2 text-faint")}>
            <HeartPulse className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            {latest ? (
              <>
                <p className="text-[14px] font-medium break-words">Connected · {latest.healthSource}</p>
                <p className="text-[12.5px] text-muted text-pretty">
                  Last sync {ago(latest.syncedAt)} · latest day {prettyDate(latest.date).toLowerCase()}
                  {latest.steps ? ` · ${fmt(latest.steps)} steps` : ""}
                  {latest.activeKcal ? ` · ${fmt(latest.activeKcal)} active kcal` : ""}
                </p>
                <p className="text-[12px] text-faint mt-1">
                  {fmt(syncedDays)} day{syncedDays === 1 ? "" : "s"} and {fmt(syncedWorkouts)} workout{syncedWorkouts === 1 ? "" : "s"} synced so far
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-medium">Not connected yet</p>
                <p className="text-[12.5px] text-muted">Steps and sleep can still be typed in on the dashboard.</p>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard needs a secure context; on a plain-http LAN address, select instead.
      inputRef.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Field label={label} hint={secret ? "Shown once. Anyone with this can add health data to your account — revoke it if it leaks." : undefined}>
      <div className="flex gap-2 min-w-0">
        <input
          ref={inputRef}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-surface-2 border border-border rounded-xl h-10 px-3 font-mono text-[12.5px] text-text"
        />
        <Button variant="secondary" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} className="shrink-0">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </Field>
  );
}

function TokensCard({ tokens, onCreated }: { tokens: Token[]; onCreated: (token: string) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [label, setLabel] = useState("iPhone");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><KeyRound className="size-3.5 text-faint" />Sync tokens</span>}
        subtitle="One per phone or app, so you can revoke one without breaking the others"
      />
      <CardBody className="space-y-3">
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="iPhone" aria-label="Token name" className="min-w-0" />
          <Button
            variant="primary"
            loading={busy}
            className="shrink-0 w-full sm:w-auto justify-center"
            onClick={async () => {
              setBusy(true);
              const result = await createHealthTokenAction(label);
              setBusy(false);
              if (result.error) return toast(result.error, "error");
              setShown(result.token!);
              onCreated(result.token!);
              router.refresh();
            }}
          >
            Create token
          </Button>
        </div>

        {shown && <CopyRow label="New token" value={shown} secret />}

        {tokens.length === 0 ? (
          <p className="text-[12.5px] text-faint">No tokens yet.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] truncate">{token.label}</p>
                  <p className="text-[11.5px] text-faint truncate">
                    <code className="font-mono">{token.prefix}…</code> · used {ago(token.lastUsedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    await revokeHealthTokenAction(token.id);
                    toast(`Revoked ${token.label}`);
                    router.refresh();
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2.5 text-[13px] text-muted list-decimal pl-5 marker:text-faint text-pretty">{children}</ol>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-surface-2 text-text break-words">{children}</code>;
}

/**
 * An iCloud link to a ready-made shortcut. It must be shared with no sync
 * address or token filled in — a shared shortcut carries whatever was typed into it.
 */
const SHORTCUT_LINK = process.env.NEXT_PUBLIC_IOS_SHORTCUT_URL ?? "";

function IphoneGuide({ endpoint }: { endpoint: string }) {
  const example = `{
  "date": "2026-09-15",
  "steps": 9120,
  "activeKcal": 612,
  "restingKcal": 1845,
  "sleep": "7 hr 12 min",
  "restingHeartRate": 58,
  "weightKg": 89.4
}`;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-[13.5px] font-semibold">Option 1 · Apple Shortcuts <span className="text-muted font-normal">— free, built into iOS</span></h3>
        {SHORTCUT_LINK && (
          <div className="space-y-2.5">
            <p className="text-[13px] text-muted text-pretty">The quickest way — add the ready-made shortcut, then put in your own address and token:</p>
            <Steps>
              <li>
                Open{" "}
                <a href={SHORTCUT_LINK} target="_blank" rel="noreferrer" className="text-text font-medium underline underline-offset-4">
                  the Nourish shortcut
                </a>{" "}
                on your iPhone and tap <strong className="text-text">Add Shortcut</strong>.
              </li>
              <li>
                Open it in <strong className="text-text">Shortcuts</strong> and scroll to <strong className="text-text">Get Contents of URL</strong>.
                Replace the address with your <strong className="text-text">Sync address</strong>, and the{" "}
                <Code>Authorization</Code> header&rsquo;s value with <strong className="text-text">Your token</strong> — copy both from above.
              </li>
              <li>Carry on from step 9 below to test it and make it run every day.</li>
            </Steps>
            <p className="text-[12px] text-faint pt-1">Or build it yourself:</p>
          </div>
        )}
        <Steps>
          <li>
            Open <strong className="text-text">Shortcuts</strong>, tap <strong className="text-text">+</strong> and name it{" "}
            <Code>Sync to Nourish</Code>. Every action below is added with the <strong className="text-text">Search</strong> bar
            at the bottom of the screen, and goes underneath the one before.
          </li>
          <li>
            <strong className="text-text">Steps.</strong> Add <strong className="text-text">Find Health Samples</strong>. Tap{" "}
            <strong className="text-text">Type</strong> and pick <strong className="text-text">Steps</strong>, then{" "}
            <strong className="text-text">Add Filter</strong> → <strong className="text-text">Start Date is today</strong>. Leave Unit,
            Group by and Sort by on None, and Limit off.
          </li>
          <li>
            Add <strong className="text-text">Calculate Statistics</strong> and change <strong className="text-text">Average</strong> to{" "}
            <strong className="text-text">Sum</strong>. Then add <strong className="text-text">Set Variable</strong> and name it{" "}
            <Code>Steps</Code>.
          </li>
          <li>
            <strong className="text-text">Active energy.</strong> The same three actions again, with the type{" "}
            <strong className="text-text">Active Calories</strong> (or Active Energy) and a variable called <Code>Active</Code>.
          </li>
          <li>
            <strong className="text-text">Sleep.</strong> Add <strong className="text-text">Find Health Samples</strong> with the type{" "}
            <strong className="text-text">Sleep</strong> and the filters <strong className="text-text">Start Date is in the last 1 day</strong>,{" "}
            <strong className="text-text">Value is not In Bed</strong> and <strong className="text-text">Value is not Awake</strong>. Then{" "}
            <strong className="text-text">Get Details of Health Samples</strong> → <strong className="text-text">Duration</strong>,{" "}
            <strong className="text-text">Calculate Statistics</strong> → <strong className="text-text">Sum</strong>, and{" "}
            <strong className="text-text">Set Variable</strong> <Code>Sleep</Code>. Hours, minutes or seconds are all understood.
          </li>
          <li>
            <strong className="text-text">Date.</strong> Add <strong className="text-text">Format Date</strong>, tap its date and pick{" "}
            <strong className="text-text">Current Date</strong>, set the format to <strong className="text-text">Custom</strong> and type{" "}
            <Code>yyyy-MM-dd</Code>.
          </li>
          <li>
            <strong className="text-text">Send.</strong> Add <strong className="text-text">Get Contents of URL</strong> and paste your{" "}
            <strong className="text-text">Sync address</strong> — copy it, don&rsquo;t type it; one wrong letter gives &ldquo;network
            connection lost&rdquo;. Open its options and set <strong className="text-text">Method</strong> to{" "}
            <strong className="text-text">POST</strong>, add a header <Code>Authorization</Code> with <strong className="text-text">Your token</strong>{" "}
            as the value, and set <strong className="text-text">Request Body</strong> to <strong className="text-text">JSON</strong>.
          </li>
          <li>
            Add these JSON fields, choosing the type as you add each one, and pick the value with{" "}
            <strong className="text-text">Select Variable</strong>. Keys are case-sensitive.
            <ul className="mt-1.5 space-y-1 list-none">
              <li><span className="text-faint">Text</span> <Code>date</Code> → Formatted Date</li>
              <li><span className="text-faint">Number</span> <Code>steps</Code> → Steps</li>
              <li><span className="text-faint">Number</span> <Code>activeKcal</Code> → Active</li>
              <li><span className="text-faint">Text</span> <Code>sleep</Code> → Sleep</li>
            </ul>
          </li>
          <li>
            Tap <strong className="text-text">▶</strong> to run it once. The reply looks different from what you sent:{" "}
            <Code>&quot;ok&quot;: true</Code> means it worked, and <Code>saved</Code> lists the values read for each day — check them
            against the Health app. If it says the network connection was lost, open the sync address in Safari on the phone: a
            &ldquo;missing token&rdquo; message means the address is reachable and the one in the shortcut is mistyped.
          </li>
          <li>
            In the <strong className="text-text">Automation</strong> tab, tap <strong className="text-text">+</strong> →{" "}
            <strong className="text-text">Time of Day</strong>, pick a time and <strong className="text-text">Daily</strong>, choose{" "}
            <strong className="text-text">Run Immediately</strong>, and pick the shortcut. If runs fail while the phone is locked, pick a
            time you are usually on it — 10 pm works well.
          </li>
        </Steps>
        <div className="space-y-1.5">
          <p className="text-[12px] text-faint">The body can be as simple as this — send whichever values you have:</p>
          <pre className="text-[12px] font-mono bg-surface-2 border border-border rounded-xl p-3 overflow-x-auto">{example}</pre>
          <p className="text-[12px] text-faint text-pretty">
            Numbers can be sent as text (&ldquo;12,345&rdquo;), and sleep as hours, minutes, seconds or &ldquo;7 hr 12 min&rdquo; —
            all are understood. For a week at once, send <Code>{`{"days": [ … ]}`}</Code>.
          </p>
        </div>
        <Notice tone="warn">
          Menu names shift slightly between iOS versions — Active Energy may be called Active Calories, and Sleep
          Analysis just Sleep. If steps arrive higher than the Health app shows, set the Steps
          filter&rsquo;s <strong>Source</strong> to your Apple Watch — the iPhone and the Watch both count the same walk.
        </Notice>
      </section>

      <section className="space-y-3 pt-4 border-t border-border">
        <h3 className="text-[13.5px] font-semibold">Option 2 · Health Auto Export <span className="text-muted font-normal">— least setup</span></h3>
        <p className="text-[13px] text-muted text-pretty">
          A third-party iOS app (not affiliated with Nourish) that syncs Apple Health on a schedule, including workouts. Its
          JSON format is recognised automatically.
        </p>
        <Steps>
          <li>In the app, create a new automation and choose <strong className="text-text">REST API</strong> as the destination.</li>
          <li>URL: the sync address above. Add a header <Code>Authorization</Code> with your token line.</li>
          <li>Export format <strong className="text-text">JSON</strong>, aggregated <strong className="text-text">by day</strong>.</li>
          <li>
            Choose Step Count, Active Energy, Resting Energy, Sleep Analysis, Resting Heart Rate, Walking + Running Distance,
            Weight and Body Fat Percentage — and turn on workouts.
          </li>
        </Steps>
      </section>

      <section className="space-y-2 pt-4 border-t border-border">
        <h3 className="text-[13.5px] font-semibold">Option 3 · Import your full history once</h3>
        <p className="text-[13px] text-muted text-pretty">
          In the Health app, tap your profile picture → <strong className="text-text">Export All Health Data</strong>, save the
          zip, and upload it below. It brings in past days and workouts; use Option 1 or 2 to keep it current.
        </p>
      </section>

      <details className="rounded-xl border border-border">
        <summary className="cursor-pointer select-none px-3.5 py-2.5 text-[12.5px] text-muted">Test from a computer with curl</summary>
        <pre className="text-[11.5px] font-mono px-3.5 pb-3 overflow-x-auto">{`curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer nsh_…' \\
  -H 'Content-Type: application/json' \\
  -d '{"steps": 9120, "sleep": "7 hr 12 min", "activeKcal": 612}'`}</pre>
      </details>
    </div>
  );
}

function AndroidGuide() {
  return (
    <div className="space-y-5">
      <Notice>
        On Android, steps, sleep and heart rate from your phone, watch or Samsung Health are gathered in{" "}
        <strong>Health Connect</strong>. Like Apple Health, it only shares with apps installed on the phone — so the data has to
        be sent here by an app on the phone, or brought in as a file.
      </Notice>

      <section className="space-y-3">
        <h3 className="text-[13.5px] font-semibold">Option 1 · An automation app that reads Health Connect</h3>
        <p className="text-[13px] text-muted text-pretty">
          Any app that can read Health Connect and send a web request works — look for one that exports Health Connect data to
          a &ldquo;webhook&rdquo; or &ldquo;REST API&rdquo;, or an automation app with Health Connect support. Point it at:
        </p>
        <Steps>
          <li>The sync address above, method <strong className="text-text">POST</strong>.</li>
          <li>A header <Code>Authorization</Code> set to your token line.</li>
          <li>
            A JSON body such as <Code>{`{"date":"2026-09-15","steps":9120,"sleep":"7 hr 12 min","activeKcal":612}`}</Code> — the
            same format the iPhone guide describes. Send it once a day.
          </li>
          <li>Grant the app Health Connect permission for the values you want to share.</li>
        </Steps>
      </section>

      <section className="space-y-2 pt-4 border-t border-border">
        <h3 className="text-[13.5px] font-semibold">Option 2 · Import a CSV</h3>
        <p className="text-[13px] text-muted text-pretty">
          Many fitness apps and Health Connect export tools can save daily totals as a spreadsheet. Upload it below. Columns are
          matched by name — <Code>Date</Code>, <Code>Steps</Code>, <Code>Sleep</Code> or <Code>Sleep (min)</Code>,{" "}
          <Code>Active Calories</Code>, <Code>Resting Heart Rate</Code>, <Code>Distance (km)</Code>, <Code>Weight (kg)</Code>,{" "}
          <Code>Body Fat</Code> — and units in brackets are respected.
        </p>
      </section>
    </div>
  );
}

function ImportCard() {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"apple" | "csv">("apple");
  const [days, setDays] = useState("365");
  const [source, setSource] = useState("Health Connect");
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    setResult(null);
    setPhase("uploading");
    setProgress(0);

    // XMLHttpRequest rather than fetch, because only it reports upload progress —
    // and an Apple export can take a while.
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({ kind, days, ...(kind === "csv" ? { source } : {}) });
    xhr.open("POST", `/api/health/import?${params}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(e.loaded / e.total);
    };
    xhr.upload.onload = () => setPhase("processing");
    xhr.onload = () => {
      setPhase("idle");
      setProgress(null);
      let body: { ok?: boolean; error?: string; summary?: string; records?: number } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 400 || !body.ok) {
        setError(body.error ?? "The import failed.");
        return;
      }
      const message = `Imported ${body.summary}${body.records ? ` from ${fmt(body.records)} records` : ""}.`;
      setResult(message);
      toast(message);
      router.refresh();
    };
    xhr.onerror = () => {
      setPhase("idle");
      setProgress(null);
      setError("The upload was interrupted. Check your connection and try again.");
    };
    xhr.send(file);
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><FileUp className="size-3.5 text-faint" />Import a file</span>}
        subtitle="Backfill history in one go. Importing the same file twice does not duplicate anything."
      />
      <CardBody className="space-y-3.5">
        <SegmentedControl
          value={kind}
          onChange={(v) => { setKind(v); setError(null); setResult(null); }}
          options={[{ value: "apple", label: "Apple Health export" }, { value: "csv", label: "CSV" }]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="How far back">
            <Select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="90">Last 3 months</option>
              <option value="365">Last year</option>
              <option value="730">Last 2 years</option>
              <option value="3650">Everything</option>
            </Select>
          </Field>
          {kind === "csv" && (
            <Field label="Where it came from">
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option>Health Connect</option>
                <option>Samsung Health</option>
                <option>Google Fit</option>
                <option>Fitbit</option>
                <option>Garmin</option>
                <option>CSV</option>
              </Select>
            </Field>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={kind === "apple" ? ".zip,.xml,application/zip,text/xml" : ".csv,text/csv"}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={phase !== "idle"}
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-border-strong px-4 py-6 grid grid-cols-1 place-items-center gap-1.5 text-center text-muted hover:bg-surface-2 transition-colors disabled:opacity-60"
        >
          <FileUp className="size-5" strokeWidth={1.6} />
          <span className="text-[13px]">
            {phase === "uploading"
              ? `Uploading… ${Math.round((progress ?? 0) * 100)}%`
              : phase === "processing"
                ? "Reading your health data…"
                : kind === "apple"
                  ? "Choose export.zip (or export.xml)"
                  : "Choose a .csv file"}
          </span>
          {phase === "idle" && (
            <span className="text-[11.5px] text-faint">
              {kind === "apple" ? "Health app → profile picture → Export All Health Data" : "Needs a Date column plus any of steps, sleep, calories, heart rate, weight"}
            </span>
          )}
        </button>

        {phase !== "idle" && (
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-kcal transition-[width]", phase === "processing" && "animate-pulse")}
              style={{ width: `${phase === "processing" ? 100 : Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        )}
        {result && <Notice>{result}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
      </CardBody>
    </Card>
  );
}

function HistoryCard({ syncs }: { syncs: Sync[] }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><RefreshCw className="size-3.5 text-faint" />Recent syncs</span>} />
      <CardBody>
        {syncs.length === 0 ? (
          <Empty>Nothing has arrived yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {syncs.map((sync) => (
              <li key={sync.id} className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-2.5 min-w-0">
                <span className={cn("mt-1.5 size-2 rounded-full shrink-0", sync.error ? "bg-danger" : "bg-success")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] break-words text-pretty">
                    {sync.source} <span className="text-faint whitespace-nowrap">· {sync.method === "import" ? "file import" : "phone sync"}</span>
                  </p>
                  <p className={cn("text-[12px] text-pretty", sync.error ? "text-danger" : "text-muted")}>{sync.error || sync.summary}</p>
                </div>
                <span className="text-[11.5px] text-faint shrink-0 whitespace-nowrap">{ago(sync.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DangerCard({ hasData }: { hasData: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!hasData) return null;

  return (
    <Card>
      <CardBody className="pt-5 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-muted text-pretty min-w-0 flex-1">
          Remove everything that came from a health app. Food, and workouts you logged yourself, are kept.
        </p>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)} className="shrink-0">
          <Trash2 className="size-3.5" /> Remove synced data
        </Button>
      </CardBody>
      <Dialog open={open} onClose={() => setOpen(false)} title="Remove synced health data?" description="Synced steps, sleep, energy, heart rate and workouts are deleted. Weigh-ins stay, since you may have entered some yourself.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await clearHealthDataAction();
              setBusy(false);
              setOpen(false);
              toast(`Removed ${result.days} synced days and ${result.workouts} workouts`);
              router.refresh();
            }}
          >
            Remove
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
