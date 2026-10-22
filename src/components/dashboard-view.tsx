"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Droplet, Dumbbell, Flame, Footprints, HeartPulse, Moon, Plus, Scale, Sparkles, Trophy, UtensilsCrossed, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CalorieRing, MacroBar } from "@/components/calorie-ring";
import { logWaterAction, logWeightAction } from "@/actions/log";
import { logSleepAction, logStepsAction } from "@/actions/daily";
import { MEAL_META, cn, fmt, prettyDate, shiftDate, shortDate, todayISO } from "@/lib/utils";
import type { DaySummary } from "@/lib/tracker";
import type { Insight } from "@/lib/insights";

type Achievement = { key: string; title: string; detail: string; icon: string; earned: boolean; value: number; target: number };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardView({
  name, day, streak, insights, insightsReady, achievements, newlyEarned, weights, goal, last7,
}: {
  name: string;
  day: DaySummary;
  streak: number;
  insights: Insight[];
  insightsReady: boolean;
  achievements: Achievement[];
  newlyEarned: { key: string; title: string; icon: string }[];
  weights: { date: string; weightKg: number }[];
  goal: { goalType: string; targetWeight: number | null; startWeight: number | null } | null;
  last7: { date: string; kcal: number; protein: number }[];
}) {
  const toast = useToast();
  const [hello, setHello] = useState("Hello");

  // The greeting depends on the viewer's clock, which the server cannot know.
  useEffect(() => setHello(greeting()), []);

  useEffect(() => {
    for (const a of newlyEarned) toast(`${a.icon} Achievement unlocked — ${a.title}`);
  }, [newlyEarned, toast]);

  const t = day.targets;
  const firstName = name.split(" ")[0];

  return (
    <div className="space-y-4 animate-in">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight truncate">
            {hello}, {firstName}
          </h1>
        </div>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-surface border border-border text-[13px] font-medium tnum">
            <Flame className="size-3.5 text-kcal" /> {streak}-day streak
          </span>
        )}
      </header>

      {!day.healthSource && <ConnectHealthBanner />}

      <div className="grid grid-cols-1 gap-4">
        <TodayCard day={day} />
        <ActivityCard day={day} />
      </div>

      <MealsGlance day={day} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <WeekCard last7={last7} target={t?.calories ?? 0} proteinTarget={t?.macros.protein ?? 0} />
        <WeightCard weights={weights} goal={goal} />
      </div>

      <InsightsCard insights={insights} ready={insightsReady} />
      <AchievementsCard achievements={achievements} />
    </div>
  );
}

function ConnectHealthBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem("nourish:health-banner-dismissed") === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  return (
    <div className="relative flex items-center gap-3 rounded-card border border-kcal/30 bg-kcal/8 px-4 py-3.5 min-w-0">
      <span className="grid place-items-center size-9 rounded-xl bg-kcal/15 text-kcal shrink-0">
        <HeartPulse className="size-4.5" />
      </span>
      <Link href="/settings/health" className="min-w-0 flex-1 group">
        <span className="block text-[13.5px] font-medium group-hover:underline underline-offset-4">Connect Apple Health or Health Connect</span>
        <span className="block text-[12px] text-muted text-pretty">Steps, sleep, active energy and workouts from your phone or watch, synced automatically.</span>
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          try { localStorage.setItem("nourish:health-banner-dismissed", "1"); } catch { /* private mode */ }
        }}
        className="grid place-items-center size-8 rounded-lg text-muted hover:text-text hover:bg-surface-2 shrink-0"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function TodayCard({ day }: { day: DaySummary }) {
  const t = day.targets;
  if (!t) {
    return (
      <Card>
        <CardBody className="pt-5">
          <Empty>
            Finish your profile in <Link href="/settings" className="underline underline-offset-4">Settings</Link> to see targets.
          </Empty>
        </CardBody>
      </Card>
    );
  }
  const over = day.remaining!.kcal < 0;

  return (
    <Card>
      <CardHeader
        title="Today"
        subtitle={
          day.earnedKcal > 0
            ? `Includes ${fmt(day.earnedKcal)} kcal earned from ${day.energySource === "measured" ? "measured activity" : "activity"}`
            : day.earnedKcal < 0
              ? `${fmt(Math.abs(day.earnedKcal))} kcal less — a quieter day than usual`
              : "Food against your target"
        }
        action={
          <Link href="/today" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            Log food <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <CalorieRing consumed={day.totals.kcal} target={day.dayCalories} size={140} />
          <div className="w-full min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
              <Figure label="Eaten" value={fmt(day.totals.kcal)} />
              <Figure label="Target" value={fmt(day.dayCalories)} />
              <Figure label={over ? "Over" : "Left"} value={fmt(Math.abs(day.remaining!.kcal))} tone={over ? "danger" : "kcal"} />
            </div>
            <MacroBar label="Protein" value={day.totals.protein} target={t.macros.protein} tone="protein" />
            <MacroBar label="Carbs" value={day.totals.carbs} target={t.macros.carbs} tone="carbs" />
            <MacroBar label="Fat" value={day.totals.fat} target={t.macros.fat} tone="fat" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "kcal" | "danger" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.07em] text-faint font-medium">{label}</div>
      <div className={cn("text-[18px] font-semibold tnum leading-tight truncate", tone === "kcal" && "text-kcal", tone === "danger" && "text-danger")}>{value}</div>
    </div>
  );
}

/** Feature: steps, sleep, water and training at a glance, each editable in place. */
function ActivityCard({ day }: { day: DaySummary }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<null | "steps" | "sleep" | "weight">(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayISO();
  const waterTarget = day.targets?.waterMl ?? 3000;

  const synced = Boolean(day.healthSource);
  const tiles = [
    {
      key: "steps" as const,
      icon: Footprints,
      label: "Steps",
      value: day.steps ? fmt(day.steps) : "—",
      note:
        day.energySource === "measured"
          ? day.distanceKm ? `${fmt(day.distanceKm, 1)} km` : "from your watch"
          : day.stepKcal > 0 ? `+${fmt(day.stepKcal)} kcal extra` : day.steps ? "within baseline" : "tap to add",
      progress: Math.min(1, day.steps / 10000),
      colour: "bg-kcal",
    },
    {
      key: "sleep" as const,
      icon: Moon,
      label: "Sleep",
      value: day.sleepHours ? `${fmt(day.sleepHours, 1)} h` : "—",
      note: day.sleepHours ? (day.sleepHours < 6.5 ? "short night" : "rested") : "tap to add",
      progress: Math.min(1, day.sleepHours / 8),
      colour: "bg-protein",
    },
  ];

  async function save() {
    const n = Number(value);
    setBusy(true);
    const result =
      editing === "steps" ? await logStepsAction(today, n)
      : editing === "sleep" ? await logSleepAction(today, n)
      : await logWeightAction(today, n);
    setBusy(false);
    if (result && "error" in result && result.error) return toast(result.error, "error");
    setEditing(null);
    setValue("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Activity"
        action={
          <Link href="/train" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            Train <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody className="space-y-3">
        {synced && (
          <p className="flex items-start gap-1.5 text-[11.5px] text-muted -mt-1 break-words">
            <HeartPulse className="size-3 text-kcal shrink-0 mt-0.5" />
            From {day.healthSource}
            {day.syncedAt ? ` · synced ${new Date(day.syncedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => {
                setEditing(tile.key);
                setValue(tile.key === "steps" ? String(day.steps || "") : String(day.sleepHours || ""));
              }}
              className="text-left rounded-xl border border-border bg-surface-2/50 hover:bg-surface-2 px-3.5 py-3 transition-colors min-w-0"
            >
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.07em] text-faint font-medium">
                <tile.icon className="size-3.5" /> {tile.label}
              </span>
              <span className="block text-[20px] font-semibold tnum leading-tight mt-1 truncate">{tile.value}</span>
              <span className="block text-[11.5px] text-muted truncate">{tile.note}</span>
              <span className="block h-1 rounded-full bg-surface-3 overflow-hidden mt-2">
                <span className={cn("block h-full rounded-full", tile.colour)} style={{ width: `${tile.progress * 100}%` }} />
              </span>
            </button>
          ))}
        </div>

        {(day.activeKcal !== null || day.restingHr !== null) && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border px-3.5 py-3 min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.07em] text-faint font-medium"><Zap className="size-3.5" /> Active</span>
              <span className="block text-[20px] font-semibold tnum leading-tight mt-1 truncate">{day.activeKcal !== null ? fmt(day.activeKcal) : "—"}</span>
              <span className="block text-[11.5px] text-muted truncate">kcal measured</span>
            </div>
            <div className="rounded-xl border border-border px-3.5 py-3 min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.07em] text-faint font-medium"><HeartPulse className="size-3.5" /> Resting HR</span>
              <span className="block text-[20px] font-semibold tnum leading-tight mt-1 truncate">{day.restingHr !== null ? fmt(day.restingHr) : "—"}</span>
              <span className="block text-[11.5px] text-muted truncate">bpm</span>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <Droplet className="size-3.5" /> Water
              <span className="tnum text-text">{(day.waterMl / 1000).toFixed(1)}</span>
              <span className="text-faint tnum">/ {(waterTarget / 1000).toFixed(1)} L</span>
            </span>
            <div className="flex gap-1.5">
              {[250, 500].map((ml) => (
                <Button key={ml} size="sm" variant="secondary" onClick={async () => { await logWaterAction(today, ml); router.refresh(); }}>
                  +{ml}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full bg-water transition-[width] duration-500" style={{ width: `${Math.min(100, (day.waterMl / waterTarget) * 100)}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-3">
          <span className="flex items-center gap-2 text-[13px] min-w-0">
            <Dumbbell className="size-3.5 text-faint shrink-0" />
            {day.training.workouts.length ? (
              <span className="truncate">
                {day.training.workouts.map((w) => w.name).join(", ")}
                <span className="text-muted tnum"> · {fmt(day.training.kcal)} kcal</span>
              </span>
            ) : (
              <span className="text-muted">No training logged today</span>
            )}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setEditing("weight")} className="shrink-0">
            <Scale className="size-3.5" /> Weigh in
          </Button>
        </div>

        {!synced && (
          <Link href="/settings/health" className="flex items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3.5 py-2.5 text-[12.5px] text-muted hover:text-text transition-colors">
            <span className="flex items-center gap-1.5 min-w-0"><HeartPulse className="size-3.5 shrink-0" /><span className="truncate">Sync steps and sleep from your phone or watch</span></span>
            <ArrowRight className="size-3.5 shrink-0" />
          </Link>
        )}
      </CardBody>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "steps" ? "Steps today" : editing === "sleep" ? "Sleep last night" : "Log your weight"}
        description={
          editing === "steps"
            ? "Only steps beyond your normal day and planned walks add calories, so nothing is counted twice."
            : editing === "sleep"
              ? "Short sleep reliably pushes appetite up the next day — worth knowing when you look back."
              : "First thing in the morning is the most consistent."
        }
      >
        <div className="space-y-4">
          <Field label={editing === "steps" ? "Steps" : editing === "sleep" ? "Hours" : "Weight (kg)"}>
            <Input
              type="number"
              inputMode="decimal"
              step={editing === "steps" ? 100 : 0.1}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder={editing === "steps" ? "8500" : editing === "sleep" ? "7.5" : "89.4"}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={save}>Save</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

function MealsGlance({ day }: { day: DaySummary }) {
  return (
    <Card>
      <CardHeader
        title="Meals"
        action={
          <Link href="/today" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            <Plus className="size-3.5" /> Add
          </Link>
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {MEAL_META.map((meal) => {
            const bucket = day.meals[meal.key];
            const names = bucket?.entries.map((e) => e.foodName) ?? [];
            return (
              <Link
                key={meal.key}
                href="/today"
                className="rounded-xl border border-border px-3.5 py-3 hover:bg-surface-2 transition-colors min-w-0"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium truncate">{meal.label}</span>
                  <UtensilsCrossed className="size-3 text-faint shrink-0" />
                </span>
                <span className="block text-[18px] font-semibold tnum mt-1">{bucket?.items ? fmt(bucket.kcal) : "—"}</span>
                <span className="block text-[11.5px] text-muted truncate">
                  {names.length ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "") : "nothing yet"}
                </span>
              </Link>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function WeekCard({ last7, target, proteinTarget }: { last7: { date: string; kcal: number; protein: number }[]; target: number; proteinTarget: number }) {
  const max = Math.max(target * 1.25, ...last7.map((d) => d.kcal), 1);
  const logged = last7.filter((d) => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : 0;
  const proteinHits = logged.filter((d) => d.protein >= proteinTarget * 0.9).length;

  return (
    <Card>
      <CardHeader
        title="This week"
        subtitle={logged.length ? `Averaging ${fmt(avg)} kcal · protein hit ${proteinHits}/${logged.length} days` : "Nothing logged yet"}
        action={
          <Link href="/reports?days=7" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            Reports <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody>
        <div className="relative h-32 flex items-end gap-1.5 sm:gap-2">
          {target > 0 && (
            <div className="absolute inset-x-0 border-t border-dashed border-border-strong" style={{ bottom: `${(target / max) * 100}%` }} aria-hidden />
          )}
          {last7.map((d) => {
            const overTarget = target > 0 && d.kcal > target * 1.1;
            return (
              <div key={d.date} className="relative flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0">
                <div
                  title={`${shortDate(d.date)}: ${fmt(d.kcal)} kcal`}
                  className={cn("w-full max-w-7 rounded-t-md transition-[height] duration-500", d.kcal ? (overTarget ? "bg-danger" : "bg-kcal") : "bg-surface-3")}
                  style={{ height: `${Math.max(d.kcal ? 4 : 2, (d.kcal / max) * 100)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 sm:gap-2 mt-1.5">
          {last7.map((d) => (
            <span key={d.date} className={cn("flex-1 text-center text-[10.5px] tnum truncate", d.date === todayISO() ? "text-text font-medium" : "text-faint")}>
              {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function WeightCard({ weights, goal }: { weights: { date: string; weightKg: number }[]; goal: { goalType: string; targetWeight: number | null; startWeight: number | null } | null }) {
  const latest = weights[weights.length - 1];
  const start = goal?.startWeight ?? weights[0]?.weightKg ?? null;
  const target = goal?.targetWeight ?? null;

  const weekAgo = shiftDate(todayISO(), -7);
  const baseline = [...weights].reverse().find((w) => w.date <= weekAgo);
  const weekChange = latest && baseline ? Math.round((latest.weightKg - baseline.weightKg) * 10) / 10 : null;

  const progress =
    latest && start != null && target != null && start !== target
      ? Math.max(0, Math.min(1, (start - latest.weightKg) / (start - target)))
      : null;

  // A tiny sparkline of the last 30 weigh-ins.
  const recent = weights.slice(-30);
  const lo = Math.min(...recent.map((w) => w.weightKg));
  const hi = Math.max(...recent.map((w) => w.weightKg));
  const span = hi - lo || 1;
  const points = recent.map((w, i) => `${recent.length === 1 ? 50 : (i / (recent.length - 1)) * 100},${36 - ((w.weightKg - lo) / span) * 32}`).join(" ");

  return (
    <Card>
      <CardHeader
        title="Weight"
        subtitle={target ? `Goal ${fmt(target, 1)} kg` : "Maintaining"}
        action={
          <Link href="/progress" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            Progress <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody className="space-y-3">
        {latest ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[28px] font-semibold tnum leading-none">{fmt(latest.weightKg, 1)}<span className="text-[14px] text-muted font-normal"> kg</span></div>
                <div className="text-[12px] text-muted mt-1">
                  {weekChange === null ? `Last weighed ${prettyDate(latest.date).toLowerCase()}` : `${weekChange > 0 ? "+" : ""}${fmt(weekChange, 1)} kg this week`}
                </div>
              </div>
              {recent.length > 1 && (
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-28 h-10 shrink-0" aria-hidden>
                  <polyline points={points} fill="none" stroke="var(--kcal)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              )}
            </div>
            {progress !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px] text-muted tnum">
                  <span>{fmt(start!, 1)} kg start</span>
                  <span>{Math.round(progress * 100)}% there</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full rounded-full bg-kcal" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <Empty>No weigh-ins yet.</Empty>
        )}
      </CardBody>
    </Card>
  );
}

function InsightsCard({ insights, ready }: { insights: Insight[]; ready: boolean }) {
  const tone = { good: "bg-success", watch: "bg-warning", info: "bg-protein" } as const;

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Sparkles className="size-3.5 text-faint" />What your last 4 weeks say</span>}
        subtitle="Worked out from your own log — no AI key needed"
        action={
          <Link href="/progress" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            All <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody>
        {!ready ? (
          <Empty>Log at least four days and patterns start showing up here.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {insights.slice(0, 4).map((insight) => (
              <li key={insight.title} className="flex gap-3 rounded-xl border border-border px-3.5 py-3 min-w-0">
                <span className={cn("mt-1.5 size-2 rounded-full shrink-0", tone[insight.tone])} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-pretty">{insight.title}</span>
                  <span className="block text-[12px] text-muted text-pretty mt-0.5">{insight.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function AchievementsCard({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((a) => a.earned).length;
  const next = achievements.filter((a) => !a.earned).slice(0, 3);
  const recent = achievements.filter((a) => a.earned).slice(0, 3);

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Trophy className="size-3.5 text-faint" />Achievements</span>}
        subtitle={`${earned} of ${achievements.length} earned`}
        action={
          <Link href="/progress#achievements" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text">
            All <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[...recent, ...next].slice(0, 3).map((a) => (
          <div key={a.key} className={cn("rounded-xl border border-border px-3.5 py-3 min-w-0", !a.earned && "bg-surface-2/40")}>
            <div className="flex items-center gap-2">
              <span className={cn("text-[20px] leading-none", !a.earned && "grayscale opacity-50")} aria-hidden>{a.icon}</span>
              <span className="text-[13px] font-medium truncate">{a.title}</span>
            </div>
            {a.earned ? (
              <p className="text-[12px] text-kcal mt-1.5">Earned</p>
            ) : (
              <div className="mt-2 space-y-1">
                <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full rounded-full bg-kcal" style={{ width: `${(a.value / a.target) * 100}%` }} />
                </div>
                <p className="text-[11.5px] text-muted tnum">{fmt(a.value)} / {fmt(a.target)}</p>
              </div>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
