"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Ruler, Sparkles, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, SegmentedControl } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteMeasurementAction, saveMeasurementAction } from "@/actions/daily";
import { cn, fmt, shortDate, todayISO } from "@/lib/utils";
import type { Insight } from "@/lib/insights";

type Measurement = {
  id: string; date: string; waistCm: number | null; chestCm: number | null; hipsCm: number | null;
  armCm: number | null; thighCm: number | null; bodyFatPct: number | null; notes: string;
};
type Achievement = { key: string; title: string; detail: string; icon: string; earned: boolean; earnedAt: string | null; value: number; target: number };

const METRICS = [
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "hipsCm", label: "Hips", unit: "cm" },
  { key: "armCm", label: "Arm", unit: "cm" },
  { key: "thighCm", label: "Thigh", unit: "cm" },
  { key: "bodyFatPct", label: "Body fat", unit: "%" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

export function ProgressView({
  measurements, insights, insightsReady, loggedDays, achievements, weights,
}: {
  measurements: Measurement[];
  insights: Insight[];
  insightsReady: boolean;
  loggedDays: number;
  achievements: Achievement[];
  weights: { date: string; weightKg: number }[];
}) {
  return (
    <div className="space-y-4 animate-in">
      <header>
        <h1 className="text-[17px] font-semibold tracking-tight">Progress</h1>
        <p className="text-[13px] text-muted mt-0.5 text-pretty">The scale is one number. Here is the rest of the picture.</p>
      </header>
      <MeasurementsCard measurements={measurements} weights={weights} />
      <ReviewCard insights={insights} ready={insightsReady} loggedDays={loggedDays} />
      <AchievementsBoard achievements={achievements} />
    </div>
  );
}

function MeasurementsCard({ measurements, weights }: { measurements: Measurement[]; weights: { date: string; weightKg: number }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const available = METRICS.filter((m) => measurements.some((row) => row[m.key] != null));
  const [metric, setMetric] = useState<MetricKey>(available[0]?.key ?? "waistCm");

  const series = measurements.filter((m) => m[metric] != null).map((m) => ({ date: m.date, value: m[metric] as number }));
  const first = series[0];
  const last = series[series.length - 1];
  const change = first && last && series.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : null;
  const meta = METRICS.find((m) => m.key === metric)!;

  // Waist down while weight holds steady is the signature of recomposition.
  const waist = measurements.filter((m) => m.waistCm != null);
  let recompNote: string | null = null;
  if (waist.length >= 2 && weights.length >= 2) {
    const waistChange = waist[waist.length - 1].waistCm! - waist[0].waistCm!;
    const from = waist[0].date;
    const weightStart = [...weights].reverse().find((w) => w.date <= from) ?? weights[0];
    const weightChange = weights[weights.length - 1].weightKg - weightStart.weightKg;
    if (waistChange <= -1.5 && Math.abs(weightChange) < 1) {
      recompNote = `Your waist is down ${fmt(Math.abs(waistChange), 1)} cm while your weight has barely moved — that is fat loss with muscle gain, which the scale alone would have hidden.`;
    }
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Ruler className="size-3.5 text-faint" />Body measurements</span>}
        subtitle="Measure every week or two, same time of day"
        action={
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {measurements.length === 0 ? (
          <Empty>No measurements yet. A tape measure catches progress the scale misses — especially if you are lifting.</Empty>
        ) : (
          <>
            {available.length > 1 && (
              <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
                <SegmentedControl
                  value={metric}
                  onChange={(v) => setMetric(v as MetricKey)}
                  options={available.map((m) => ({ value: m.key, label: m.label }))}
                />
              </div>
            )}

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[26px] font-semibold tnum leading-none">
                {last ? fmt(last.value, 1) : "—"}
                <span className="text-[14px] text-muted font-normal"> {meta.unit}</span>
              </span>
              {change !== null && (
                <span className={cn("text-[13px] tnum", change < 0 ? "text-kcal" : "text-muted")}>
                  {change > 0 ? "+" : ""}{fmt(change, 1)} {meta.unit} since {shortDate(first.date)}
                </span>
              )}
            </div>

            {series.length > 1 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis width={40} domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(Number(v), 0)} />
                    <Tooltip
                      formatter={(v) => [`${fmt(Number(v), 1)} ${meta.unit}`, meta.label]}
                      labelFormatter={(l) => shortDate(String(l))}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--kcal)" strokeWidth={2} dot={{ r: 3, fill: "var(--kcal)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {recompNote && <div className="rounded-xl border border-success/25 bg-success/8 px-3.5 py-3 text-[13px] text-pretty">{recompNote}</div>}

            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.06em] text-faint">
                    <th className="text-left font-medium pb-2">Date</th>
                    {METRICS.map((m) => (
                      <th key={m.key} className="text-right font-medium pb-2">{m.label}</th>
                    ))}
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...measurements].reverse().map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2 pr-3 whitespace-nowrap">{shortDate(row.date)}</td>
                      {METRICS.map((m) => (
                        <td key={m.key} className="py-2 text-right tnum text-muted">{row[m.key] != null ? fmt(row[m.key] as number, 1) : "—"}</td>
                      ))}
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Delete measurement from ${shortDate(row.date)}`}
                          className="p-1 text-faint hover:text-danger transition-colors"
                          onClick={async () => {
                            await deleteMeasurementAction(row.id);
                            toast("Measurement removed");
                            router.refresh();
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
      <AddMeasurementDialog open={adding} onClose={() => setAdding(false)} />
    </Card>
  );
}

function AddMeasurementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="Add measurements" description="Fill in whichever you measured. Measuring the same day again replaces it." wide>
      <div className="space-y-4">
        <Field label="Date">
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {METRICS.map((m) => (
            <Field key={m.key} label={`${m.label} (${m.unit})`}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={values[m.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const payload: Record<string, unknown> = { date };
              for (const m of METRICS) payload[m.key] = values[m.key] ? Number(values[m.key]) : null;
              const result = await saveMeasurementAction(payload);
              setBusy(false);
              if (result.error) return toast(result.error, "error");
              toast("Measurements saved");
              setValues({});
              onClose();
              router.refresh();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReviewCard({ insights, ready, loggedDays }: { insights: Insight[]; ready: boolean; loggedDays: number }) {
  const tone = { good: "bg-success", watch: "bg-warning", info: "bg-protein" } as const;
  const label = { good: "Going well", watch: "Worth a look", info: "Worth knowing" } as const;

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Sparkles className="size-3.5 text-faint" />Four-week review</span>}
        subtitle="Patterns in your own log, worked out without AI"
      />
      <CardBody>
        {!ready ? (
          <Empty>You have logged {loggedDays} day{loggedDays === 1 ? "" : "s"} in the last four weeks. The review needs at least four.</Empty>
        ) : (
          <ul className="space-y-2.5">
            {insights.map((insight) => (
              <li key={insight.title} className="flex gap-3 rounded-xl border border-border px-3.5 py-3">
                <span className={cn("mt-1.5 size-2 rounded-full shrink-0", tone[insight.tone])} />
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-[0.06em] text-faint">{label[insight.tone]}</span>
                  <span className="block text-[13.5px] font-medium text-pretty">{insight.title}</span>
                  <span className="block text-[12.5px] text-muted text-pretty mt-0.5">{insight.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function AchievementsBoard({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((a) => a.earned).length;
  return (
    <div id="achievements" className="scroll-mt-20">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Trophy className="size-3.5 text-faint" />Achievements</span>}
          subtitle={`${earned} of ${achievements.length} earned — all about habits you control, none about the scale`}
        />
        <CardBody className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <div key={a.key} className={cn("rounded-xl border border-border px-3.5 py-3 min-w-0", !a.earned && "bg-surface-2/40")}>
              <div className="flex items-start gap-3">
                <span className={cn("text-[24px] leading-none shrink-0", !a.earned && "grayscale opacity-40")} aria-hidden>{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{a.title}</p>
                  <p className="text-[12px] text-muted text-pretty">{a.detail}</p>
                  {a.earned ? (
                    <p className="text-[11.5px] text-kcal mt-1">Earned {a.earnedAt ? shortDate(a.earnedAt.slice(0, 10)) : ""}</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full bg-kcal" style={{ width: `${(a.value / a.target) * 100}%` }} />
                      </div>
                      <p className="text-[11px] text-faint tnum">{fmt(a.value)} / {fmt(a.target)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
