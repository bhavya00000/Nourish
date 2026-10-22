"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice, Stat } from "@/components/ui/card";
import { Chip, Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { dayPlanAction, insightAction, suggestMealAction } from "@/actions/ai";
import { logWorkoutAction, trainingPlanAction } from "@/actions/training";
import { logTextAction } from "@/actions/log";
import { MEAL_META, fmt, todayISO } from "@/lib/utils";
import type { DayPlan, Insight, MealSuggestion, TrainingPlan } from "@/lib/ai";
import type { DaySummary } from "@/lib/tracker";

export function CoachView({ day, aiOn }: { day: DaySummary; aiOn: boolean }) {
  const t = day.targets;

  return (
    <div className="space-y-4 animate-in">
      <header>
        <h1 className="text-[17px] font-semibold tracking-tight">Coach</h1>
        <p className="text-[13px] text-muted mt-0.5 text-pretty">
          Suggestions are built from today&rsquo;s actual numbers and your food preferences.
        </p>
      </header>

      {!aiOn && (
        <Notice tone="warn">
          <strong>AI features are switched off.</strong> Get a free key at{" "}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            console.groq.com/keys
          </a>
          , put it in <code className="font-mono text-[12px]">.env</code> as <code className="font-mono text-[12px]">GROQ_API_KEY</code> and restart. Everything else works without it.
        </Notice>
      )}

      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Eaten today" value={fmt(day.totals.kcal)} note={`of ${fmt(t.calories)} kcal`} />
          <Stat
            label="Calories left"
            value={fmt(day.remaining!.kcal)}
            note="kcal"
            tone={day.remaining!.kcal < 0 ? "danger" : "kcal"}
          />
          <Stat label="Protein left" value={`${fmt(Math.max(0, day.remaining!.protein))} g`} note={`of ${fmt(t.macros.protein)} g`} tone="protein" />
          <Stat label="Logged" value={day.totals.items} note="items today" />
        </div>
      )}

      <SuggestCard aiOn={aiOn} />
      <PlanCard aiOn={aiOn} />
      <TrainingPlanCard aiOn={aiOn} />
      <InsightCard aiOn={aiOn} />
    </div>
  );
}

function defaultMeal() {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 19) return "snacks";
  return "dinner";
}

function SuggestCard({ aiOn }: { aiOn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [meal, setMeal] = useState(defaultMeal());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MealSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="What should I eat next?" subtitle="Three options that fit what is left in your day" />
      <CardBody className="space-y-3.5">
        <Field group label="For which meal">
          <div className="flex flex-wrap gap-2">
            {MEAL_META.filter((m) => m.key !== "event").map((m) => (
              <Chip key={m.key} active={meal === m.key} onClick={() => setMeal(m.key)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Anything specific? (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="quick, no cooking, high protein, hostel mess" />
        </Field>
        <Button
          variant="primary"
          className="w-full"
          disabled={!aiOn}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setResult(null);
            const response = await suggestMealAction({ meal, preferences: note.trim() || undefined });
            setBusy(false);
            if (response.error) return setError(response.error);
            setResult(response.suggestion ?? null);
          }}
        >
          <Sparkles className="size-3.5" /> Suggest meals
        </Button>

        {error && <p className="text-[13px] text-danger text-pretty">{error}</p>}

        {result && (
          <div className="space-y-3 pt-1">
            {result.headline && <Notice>{result.headline}</Notice>}
            {result.options?.map((option, i) => (
              <div key={i} className="rounded-xl border border-border p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13.5px] font-semibold">{option.name}</h3>
                  <span className="text-[11.5px] text-muted tnum shrink-0">
                    {fmt(option.kcal)} kcal · {fmt(option.protein)} g P
                  </span>
                </div>
                <ul className="text-[12.5px] text-muted space-y-0.5 list-disc list-inside">
                  {option.items?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {option.why && <p className="text-[12px] text-faint italic text-pretty">{option.why}</p>}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const logged = await logTextAction({ text: (option.items ?? []).join(", "), meal, date: todayISO() });
                    if (logged.error) return toast(logged.error, "error");
                    toast(`Logged ${logged.added} items · ${fmt(logged.kcal)} kcal`);
                    router.refresh();
                  }}
                >
                  Log this
                </Button>
              </div>
            ))}
            {result.tip && <p className="text-[12.5px] text-muted text-pretty">{result.tip}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function PlanCard({ aiOn }: { aiOn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Build me a full day" subtitle="A whole day of meals that hits your target" />
      <CardBody className="space-y-3.5">
        <Field label="Preferences for the day (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mostly veg, one egg dish, easy to cook" />
        </Field>
        <Button
          variant="secondary"
          className="w-full"
          disabled={!aiOn}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setPlan(null);
            const response = await dayPlanAction({ preferences: note.trim() || undefined });
            setBusy(false);
            if (response.error) return setError(response.error);
            setPlan(response.plan ?? null);
          }}
        >
          Generate day plan
        </Button>

        {error && <p className="text-[13px] text-danger text-pretty">{error}</p>}

        {plan && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-2 text-[11.5px] text-muted tnum">
              <span className="px-2 py-1 rounded-md bg-surface-2">{fmt(plan.total_kcal)} kcal</span>
              <span className="px-2 py-1 rounded-md bg-surface-2">{fmt(plan.total_protein)} g protein</span>
            </div>
            {plan.meals?.map((meal, i) => (
              <div key={i} className="rounded-xl border border-border p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13.5px] font-semibold capitalize">{meal.meal}</h3>
                  <span className="text-[11.5px] text-muted tnum shrink-0">
                    {fmt(meal.kcal)} kcal · {fmt(meal.protein)} g
                  </span>
                </div>
                <ul className="text-[12.5px] text-muted space-y-0.5 list-disc list-inside">
                  {meal.items?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {plan.notes && <p className="text-[12.5px] text-muted text-pretty">{plan.notes}</p>}
            <Button
              variant="primary"
              className="w-full"
              onClick={async () => {
                for (const meal of plan.meals ?? []) {
                  await logTextAction({ text: (meal.items ?? []).join(", "), meal: meal.meal, date: todayISO() });
                }
                toast("Whole day logged — adjust anything that is off on the Today tab.");
                router.refresh();
              }}
            >
              Log the whole day
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** A weekly split, built against the calorie goal rather than in isolation. */
function TrainingPlanCard({ aiOn }: { aiOn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [days, setDays] = useState("4");
  const [equipment, setEquipment] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarDays className="size-3.5 text-faint" />
            Plan my training week
          </span>
        }
        subtitle="A split matched to your goal, your calories and the days you actually have"
      />
      <CardBody className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Days per week">
            <Input type="number" inputMode="numeric" min={1} max={7} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field label="Equipment">
            <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="full gym, or dumbbells only" />
          </Field>
        </div>
        <Field label="Anything else? (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="bad knee, 45 min sessions, want to keep running" />
        </Field>

        <Button
          variant="secondary"
          className="w-full"
          disabled={!aiOn}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setPlan(null);
            const result = await trainingPlanAction({
              daysPerWeek: Number(days) || 4,
              equipment: equipment.trim() || undefined,
              preferences: note.trim() || undefined,
            });
            setBusy(false);
            if (result.error) return setError(result.error);
            setPlan(result.plan ?? null);
          }}
        >
          Build my week
        </Button>

        {error && <p className="text-[13px] text-danger text-pretty">{error}</p>}

        {plan && (
          <div className="space-y-3">
            <Notice>
              <strong>{plan.split}</strong>
              {plan.rationale ? ` — ${plan.rationale}` : ""}
            </Notice>

            {plan.days?.map((day, i) => {
              const rest = /rest/i.test(day.focus);
              return (
                <div key={i} className="rounded-xl border border-border p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[13.5px] font-semibold">
                      {day.day}
                      <span className="text-muted font-normal"> · {day.focus}</span>
                    </h3>
                  </div>
                  {day.exercises?.length > 0 && (
                    <ul className="text-[12.5px] text-muted space-y-0.5 list-disc list-inside">
                      {day.exercises.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {day.cardio && <p className="text-[12.5px] text-muted">Cardio: {day.cardio}</p>}
                  {day.notes && <p className="text-[12px] text-faint text-pretty">{day.notes}</p>}
                  {!rest && day.exercises?.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const text = [...day.exercises, day.cardio].filter(Boolean).join(", ");
                        const result = await logWorkoutAction({ text, date: todayISO(), name: `${day.focus}` });
                        if ("error" in result && result.error) return toast(result.error, "error");
                        toast(`Logged as today's session · ${fmt(("kcal" in result && result.kcal) || 0)} kcal`);
                        router.refresh();
                      }}
                    >
                      Log this as today
                    </Button>
                  )}
                </div>
              );
            })}

            {plan.cardio_guidance && (
              <p className="text-[12.5px] text-muted text-pretty">
                <strong>Cardio:</strong> {plan.cardio_guidance}
              </p>
            )}
            {plan.progression && (
              <p className="text-[12.5px] text-muted text-pretty">
                <strong>Progression:</strong> {plan.progression}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function InsightCard({ aiOn }: { aiOn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Review my last two weeks" subtitle="An honest read on what your data shows" />
      <CardBody className="space-y-3.5">
        <Button
          variant="secondary"
          className="w-full"
          disabled={!aiOn}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setInsight(null);
            const response = await insightAction();
            setBusy(false);
            if (response.error) return setError(response.error);
            setInsight(response.insight ?? null);
          }}
        >
          Get my review
        </Button>

        {error && <p className="text-[13px] text-danger text-pretty">{error}</p>}

        {insight && (
          <div className="space-y-3">
            <Notice>{insight.summary}</Notice>
            {insight.wins?.length > 0 && <InsightList title="Working well" items={insight.wins} />}
            {insight.fixes?.length > 0 && <InsightList title="Worth changing" items={insight.fixes} />}
            {insight.focus && (
              <Notice>
                <strong>This week:</strong> {insight.focus}
              </Notice>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold text-muted mb-1.5">{title}</h3>
      <ul className="text-[12.5px] text-muted space-y-1 list-disc list-inside">
        {items.map((item) => (
          <li key={item} className="text-pretty">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
