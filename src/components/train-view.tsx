"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, CornerDownLeft, Dumbbell, Flame, Plus, Repeat, Sparkles, Timer, Trash2, TrendingUp,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty, Notice, Stat } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Chip, Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  createRoutineAction, deleteRoutineAction, deleteSetAction, deleteWorkoutAction,
  logRoutineAction, logWorkoutAction, suggestWorkoutAction,
} from "@/actions/training";
import { fmt, prettyDate, qty, shiftDate, todayISO } from "@/lib/utils";
import type { WorkoutAdvice } from "@/lib/ai";

type SetRow = {
  id: string; reps: number | null; weightKg: number | null; durationMin: number | null;
  distanceKm: number | null; setNumber: number; kcal: number;
  exercise: { id: string; name: string; category: string; isCardio: boolean };
};
type Workout = { id: string; name: string; type: string; kcal: number; durationMin: number; notes: string; source: string; distanceKm: number | null; sets: SetRow[] };
type Routine = { id: string; name: string; focus: string; items: { id: string; name: string; sets: number; reps: number | null; weightKg: number | null; durationMin: number | null; isCardio: boolean }[] };

export function TrainView({
  date, day, summary, records, routines, aiOn, useLoggedWorkouts,
}: {
  date: string;
  day: { workouts: Workout[]; kcal: number; minutes: number; volumeKg: number };
  summary: { sessions: number; perWeek: number; cardioMinutes: number; strengthSets: number; volumeKg: number; byCategory: { category: string; sets: number }[]; trainedDays: number };
  records: { exerciseId: string; name: string; weightKg: number; reps: number; oneRm: number; date: string }[];
  routines: Routine[];
  aiOn: boolean;
  useLoggedWorkouts: boolean;
}) {
  const router = useRouter();
  const [creatingRoutine, setCreatingRoutine] = useState(false);
  const goTo = (next: string) => router.push(`/train?date=${next}`);

  return (
    <div className="space-y-4 animate-in">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => goTo(shiftDate(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <h1 className="text-[17px] font-semibold tracking-tight min-w-32 text-center">{prettyDate(date)}</h1>
          <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => goTo(shiftDate(date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {date !== todayISO() && (
          <Button size="sm" variant="ghost" onClick={() => goTo(todayISO())}>
            Today
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Burnt today" value={fmt(day.kcal)} note="kcal" tone="kcal" />
        <Stat label="Time" value={`${fmt(day.minutes)}m`} note={day.workouts.length ? `${day.workouts.length} session${day.workouts.length > 1 ? "s" : ""}` : "nothing yet"} />
        <Stat label="Volume" value={`${fmt(day.volumeKg)}`} note="kg lifted" />
        <Stat label="This month" value={`${fmt(summary.perWeek, 1)}×`} note="sessions / week" />
      </div>

      {useLoggedWorkouts && day.kcal > 0 && (
        <Notice>
          Today&rsquo;s session added <strong>{fmt(day.kcal)} kcal</strong> to your food budget, because you have
          &ldquo;use logged workouts&rdquo; turned on.{" "}
          <Link href="/today" className="underline underline-offset-4">
            See today
          </Link>
          .
        </Notice>
      )}

      <LogWorkoutCard date={date} aiOn={aiOn} />

      {routines.length > 0 && (
        <Card>
          <CardHeader title="Routines" subtitle="One tap logs the whole session" action={
            <Button variant="ghost" size="sm" onClick={() => setCreatingRoutine(true)}>
              <Plus className="size-3.5" /> New
            </Button>
          } />
          <CardBody className="flex flex-wrap gap-2">
            {routines.map((routine) => (
              <RoutineChip key={routine.id} routine={routine} date={date} />
            ))}
          </CardBody>
        </Card>
      )}

      {day.workouts.length === 0 ? (
        <Card>
          <CardBody className="pt-5">
            <Empty>
              Nothing logged for {prettyDate(date).toLowerCase()}. Type a session above — sets, reps and calories are
              worked out for you.
            </Empty>
          </CardBody>
        </Card>
      ) : (
        day.workouts.map((workout) => <WorkoutCard key={workout.id} workout={workout} />)
      )}

      {routines.length === 0 && (
        <Card>
          <CardBody className="pt-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-muted text-pretty">
              Save a session you repeat — &ldquo;Push A&rdquo; — and log it in one tap next time.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setCreatingRoutine(true)}>
              <Plus className="size-3.5" /> New routine
            </Button>
          </CardBody>
        </Card>
      )}

      <WorkoutCoachCard aiOn={aiOn} date={date} />

      {records.length > 0 && (
        <Card>
          <CardHeader title="Personal bests" subtitle="Estimated one-rep max, Epley formula" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.06em] text-faint">
                    <th className="text-left font-medium pb-2">Exercise</th>
                    <th className="text-right font-medium pb-2">Best set</th>
                    <th className="text-right font-medium pb-2">Est. 1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.exerciseId} className="border-t border-border">
                      <td className="py-2 pr-3">{record.name}</td>
                      <td className="py-2 text-right tnum text-muted">
                        {qty(record.weightKg)} kg × {record.reps}
                      </td>
                      <td className="py-2 text-right tnum font-medium">{qty(record.oneRm)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {summary.sessions > 0 && (
        <Card>
          <CardHeader title="Last 30 days" subtitle={`${summary.trainedDays} training day${summary.trainedDays === 1 ? "" : "s"} · ${fmt(summary.strengthSets)} set${summary.strengthSets === 1 ? "" : "s"} · ${fmt(summary.cardioMinutes)} min cardio`} />
          <CardBody className="space-y-3">
            {summary.byCategory.map((row) => {
              const total = summary.byCategory.reduce((sum, r) => sum + r.sets, 0) || 1;
              return (
                <div key={row.category} className="space-y-1.5">
                  <div className="flex justify-between text-[12.5px]">
                    <span className="capitalize text-muted">{row.category}</span>
                    <span className="tnum">
                      {row.sets} set{row.sets === 1 ? "" : "s"} <span className="text-faint">· {Math.round((row.sets / total) * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full rounded-full bg-protein" style={{ width: `${(row.sets / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <CreateRoutineDialog open={creatingRoutine} onClose={() => setCreatingRoutine(false)} />
    </div>
  );
}

function LogWorkoutCard({ date, aiOn }: { date: string; aiOn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; category: string; equipment: string }[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) {
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/exercises/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen((data.results ?? []).length > 0);
      } catch {
        /* aborted */
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setOpen(false);

    const result = await logWorkoutAction({ text: value, date });
    setBusy(false);

    if ("error" in result && result.error) return toast(result.error, "error");
    if ("exercises" in result && result.exercises) {
      const ai = result.aiAdded.length ? ` · ${result.aiAdded.length} added by AI` : "";
      toast(`Logged ${result.exercises} exercise${result.exercises > 1 ? "s" : ""} · ${fmt(result.kcal)} kcal${ai}`);
      setText("");
      router.refresh();
    }
    if ("failed" in result) for (const failure of result.failed) toast(`“${failure.phrase}” — ${failure.reason}`, "error");
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Dumbbell className="size-3.5 text-faint" />
            Log a session
          </span>
        }
        subtitle="Type it the way you would say it — sets, reps, weight and calories are worked out"
      />
      <CardBody>
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => setTimeout(() => setOpen(false), 130)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  } else if (e.key === "Escape") setOpen(false);
                }}
                placeholder="bench 3x8 60kg, barbell row 3x10 50kg, running 15 min"
                spellCheck={false}
                autoComplete="off"
                aria-label="What did you train?"
                className={
                  "w-full bg-surface-2 border border-border rounded-xl h-10 pl-3.5 pr-9 text-sm transition-colors " +
                  "placeholder:text-faint hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
                }
              />
              {busy ? (
                <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
              ) : (
                text.trim() && <CornerDownLeft className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
              )}
            </div>
            {text.trim() && (
              <Button variant="primary" onClick={submit} loading={busy} className="animate-pop">
                Log
              </Button>
            )}
          </div>

          {open && (
            <ul className="absolute z-30 left-0 right-0 top-[calc(100%+6px)] bg-surface border border-border rounded-xl shadow-[var(--shadow-pop)] overflow-hidden max-h-64 overflow-y-auto animate-pop">
              {results.map((result) => (
                <li key={result.id} className="px-3.5 py-2 flex items-center gap-2 text-[13px] border-b border-border last:border-0">
                  <span className="flex-1 truncate">{result.name}</span>
                  <span className="text-[11px] text-faint capitalize">{result.category} · {result.equipment}</span>
                </li>
              ))}
              <li className="px-3.5 py-2 text-[11.5px] text-faint bg-surface-2">
                Add sets and reps, then press Enter — e.g. <span className="font-mono">3x8 60kg</span>
                {aiOn && ". Unknown movements are classified by AI."}
              </li>
            </ul>
          )}
        </div>

        <p className="text-[11.5px] text-faint mt-2">
          Understands <span className="font-mono">3x8</span>, <span className="font-mono">4x6 @70kg</span>,{" "}
          <span className="font-mono">135lb</span>, <span className="font-mono">20 min</span>,{" "}
          <span className="font-mono">5 km</span>, <span className="font-mono">3x60s</span>.
        </p>
      </CardBody>
    </Card>
  );
}

function WorkoutCard({ workout }: { workout: Workout }) {
  const router = useRouter();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);

  // Sets of the same exercise are shown together.
  const grouped = workout.sets.reduce<{ name: string; isCardio: boolean; sets: SetRow[] }[]>((acc, set) => {
    const last = acc[acc.length - 1];
    if (last && last.name === set.exercise.name) last.sets.push(set);
    else acc.push({ name: set.exercise.name, isCardio: set.exercise.isCardio, sets: [set] });
    return acc;
  }, []);

  return (
    <Card>
      <CardHeader
        title={workout.name || "Training"}
        subtitle={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Flame className="size-3" />{fmt(workout.kcal)} kcal</span>
            <span className="flex items-center gap-1"><Timer className="size-3" />{workout.durationMin} min</span>
            <span className="capitalize">{workout.type}</span>
            {workout.source !== "manual" && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-kcal/12 text-kcal">{workout.source}</span>
            )}
          </span>
        }
        action={
          <Button
            variant="ghost"
            size="icon"
            loading={removing}
            aria-label={`Delete ${workout.name}`}
            onClick={async () => {
              setRemoving(true);
              const result = await deleteWorkoutAction(workout.id);
              setRemoving(false);
              if (result.error) return toast(result.error, "error");
              toast("Workout removed");
              router.refresh();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
      <CardBody className="space-y-2.5">
        {grouped.length === 0 && (
          <p className="text-[12.5px] text-muted">
            {workout.durationMin} min{workout.distanceKm ? ` · ${qty(Math.round(workout.distanceKm * 10) / 10)} km` : ""}
            {workout.source !== "manual" ? ` · recorded by ${workout.source}` : ""}
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.name} className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-medium">{group.name}</span>
              <span className="text-[11.5px] text-faint tnum">
                {fmt(group.sets.reduce((s, x) => s + x.kcal, 0))} kcal
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {group.sets.map((set) => (
                <SetPill key={set.id} set={set} isCardio={group.isCardio} />
              ))}
            </div>
          </div>
        ))}
        {workout.notes && <p className="text-[12.5px] text-muted">{workout.notes}</p>}
      </CardBody>
    </Card>
  );
}

function SetPill({ set, isCardio }: { set: SetRow; isCardio: boolean }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  const label = isCardio
    ? [set.durationMin ? `${qty(set.durationMin)} min` : null, set.distanceKm ? `${qty(set.distanceKm)} km` : null].filter(Boolean).join(" · ")
    : [set.reps ? `${set.reps} reps` : null, set.weightKg ? `${qty(set.weightKg)} kg` : null, set.durationMin ? `${qty(set.durationMin * 60)}s` : null]
        .filter(Boolean)
        .join(" × ") || "1 set";

  return (
    <button
      type="button"
      title="Remove this set"
      disabled={removing}
      onClick={async () => {
        setRemoving(true);
        await deleteSetAction(set.id);
        router.refresh();
      }}
      className="group px-2.5 h-7 rounded-lg bg-surface border border-border text-[12px] tnum hover:border-danger/40 hover:text-danger transition-colors disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function RoutineChip({ routine, date }: { routine: Routine; date: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <span className="inline-flex items-center">
      <Chip
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await logRoutineAction({ routineId: routine.id, date });
          setBusy(false);
          if ("error" in result && result.error) return toast(result.error, "error");
          toast(`Logged ${routine.name} · ${fmt(("kcal" in result && result.kcal) || 0)} kcal`);
          router.refresh();
        }}
      >
        <Repeat className="size-3 mr-1.5 inline" />
        {routine.name}
        <span className="text-faint"> · {routine.items.length}</span>
      </Chip>
      <button
        type="button"
        aria-label={`Delete ${routine.name}`}
        onClick={async () => {
          await deleteRoutineAction(routine.id);
          toast(`Deleted ${routine.name}`);
          router.refresh();
        }}
        className="ml-1 text-faint hover:text-danger transition-colors p-1"
      >
        <Trash2 className="size-3" />
      </button>
    </span>
  );
}

function CreateRoutineDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="New routine" description="Write the session once, log it in one tap from then on." wide>
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push A" />
        </Field>
        <Field label="Exercises" hint="Same format as logging, e.g. “bench 4x8 60kg, ohp 3x10 30kg, dips 3x12”.">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="bench 4x8 60kg, ohp 3x10 30kg, lateral raise 3x15 8kg" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await createRoutineAction({ name, text });
              setBusy(false);
              if (result.error) return toast(result.error, "error");
              if (result.skipped?.length) toast(`Saved, but not recognised: ${result.skipped.join(", ")}`, "error");
              else toast(`Saved ${name}`);
              setName("");
              setText("");
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

function WorkoutCoachCard({ aiOn, date }: { aiOn: boolean; date: string }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<WorkoutAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <TrendingUp className="size-3.5 text-faint" />
            What should I train today?
          </span>
        }
        subtitle="Uses what you have trained this week and what you have eaten today"
      />
      <CardBody className="space-y-3.5">
        <Field label="Anything specific? (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="45 minutes, dumbbells only, sore legs" />
        </Field>
        <Button
          variant="primary"
          className="w-full"
          disabled={!aiOn}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setAdvice(null);
            const result = await suggestWorkoutAction({ preferences: note.trim() || undefined });
            setBusy(false);
            if (result.error) return setError(result.error);
            setAdvice(result.advice ?? null);
          }}
        >
          <Sparkles className="size-3.5" /> Suggest a session
        </Button>

        {!aiOn && (
          <p className="text-[12.5px] text-muted text-pretty">
            Add an AI key in{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Settings
            </Link>{" "}
            to use the coach. Everything else on this page works without one.
          </p>
        )}
        {error && <p className="text-[13px] text-danger text-pretty">{error}</p>}

        {advice && (
          <div className="space-y-3">
            <Notice>{advice.headline}</Notice>
            {advice.suggestion && <p className="text-[13px] text-muted text-pretty">{advice.suggestion}</p>}
            {advice.exercises?.length > 0 && (
              <div className="rounded-xl border border-border p-3.5 space-y-2">
                <ul className="text-[12.5px] text-muted space-y-0.5 list-disc list-inside">
                  {advice.exercises.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {advice.cardio && <p className="text-[12.5px] text-muted">Cardio: {advice.cardio}</p>}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const text = [...advice.exercises, advice.cardio].filter(Boolean).join(", ");
                    const result = await logWorkoutAction({ text, date });
                    if ("error" in result && result.error) return toast(result.error, "error");
                    toast(`Logged ${"exercises" in result ? result.exercises : 0} exercises`);
                    router.refresh();
                  }}
                >
                  Log this session
                </Button>
              </div>
            )}
            {advice.fuelling && (
              <Notice tone="warn">
                <strong>Fuelling:</strong> {advice.fuelling}
              </Notice>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
