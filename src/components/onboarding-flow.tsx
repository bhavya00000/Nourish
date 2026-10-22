"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Chip, Textarea, SegmentedControl } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { PlanSummary } from "@/components/plan-summary";
import { previewTargets, saveOnboarding } from "@/actions/profile";
import type { Targets } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const JOBS = [
  ["desk", "Desk job or student — mostly sitting"],
  ["standing", "On my feet — teaching, retail, lab"],
  ["field", "Moving all day — sales, delivery, nursing"],
  ["labour", "Physical work — construction, warehouse, farming"],
] as const;

const GYMS = [
  ["none", "Not training right now"],
  ["weights", "Weight training"],
  ["cardio", "Cardio — running, cycling, swimming"],
  ["mixed", "Weights and cardio"],
  ["yoga", "Yoga, pilates or stretching"],
  ["sports", "Sports — football, cricket, badminton"],
] as const;

const GOALS = [
  ["lose", "Lose weight"],
  ["gain", "Gain weight"],
  ["recomp", "Build muscle"],
  ["maintain", "Maintain"],
] as const;

const DIETS = [
  ["veg", "Vegetarian"],
  ["eggetarian", "Eggetarian"],
  ["nonveg", "Non-vegetarian"],
  ["vegan", "Vegan"],
] as const;

export type OnboardingState = {
  age: number | null;
  sex: string;
  heightCm: number | null;
  weightKg: number | null;
  jobRole: string;
  gymType: string;
  gymDays: number;
  walkMinutes: number;
  dietType: string;
  cuisines: string;
  allergies: string;
  dislikes: string;
  extraInfo: string;
  eatingWindowH: number;
  goalType: string;
  targetWeight: number | null;
  targetWeeks: number;
};

const STEPS = ["You", "Activity", "Goal", "Food", "Plan"];

/** Round to whole inches first, so 152 cm reads 5 ft 0 in rather than 4 ft 12 in. */
function feetAndInches(cm: number | null | undefined) {
  if (!cm) return { feet: "", inches: "" };
  const total = Math.round(cm / 2.54);
  return { feet: String(Math.floor(total / 12)), inches: String(total % 12) };
}

export function OnboardingFlow({ initial }: { initial: OnboardingState }) {
  const [state, setState] = useState<OnboardingState>(initial);
  const [step, setStep] = useState(0);
  const [heightUnit, setHeightUnit] = useState<"ft" | "cm">("ft");
  const [targets, setTargets] = useState<Targets | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const set = <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Feet and inches are held separately. Deriving them back from a rounded cm
  // value loses precision -- 5 ft becomes 152 cm, which reads back as 4 ft.
  const [feet, setFeet] = useState(() => feetAndInches(initial.heightCm).feet);
  const [inches, setInches] = useState(() => feetAndInches(initial.heightCm).inches);

  function setHeightImperial(ft: string, inch: string) {
    setFeet(ft);
    setInches(inch);
    const totalInches = (Number(ft) || 0) * 12 + (Number(inch) || 0);
    set("heightCm", totalInches ? Math.round(totalInches * 2.54) : null);
  }

  function next() {
    if (step === 0) {
      if (!state.age) return toast("Enter your age.", "error");
      if (!state.heightCm) return toast("Enter your height.", "error");
      if (!state.weightKg) return toast("Enter your current weight.", "error");
    }
    if (step === 2 && state.goalType !== "maintain" && !state.targetWeight) {
      return toast("Enter the weight you are aiming for.", "error");
    }
    if (step === 3) return save();
    setStep((s) => s + 1);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        profile: {
          age: state.age, sex: state.sex, heightCm: state.heightCm, weightKg: state.weightKg,
          jobRole: state.jobRole, gymType: state.gymType, gymDays: state.gymDays,
          walkMinutes: state.walkMinutes, dietType: state.dietType, cuisines: state.cuisines,
          allergies: state.allergies, dislikes: state.dislikes, extraInfo: state.extraInfo,
          eatingWindowH: state.eatingWindowH,
        },
        goal: { goalType: state.goalType, targetWeight: state.targetWeight, targetWeeks: state.targetWeeks },
      };
      const result = await saveOnboarding(payload);
      if (result?.error) return toast(result.error, "error");

      const computed = await previewTargets({});
      setTargets(computed);
      setStep(4);
    });
  }

  return (
    <div className="space-y-7 animate-in">
      <ol className="flex items-center gap-1.5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={cn("h-[3px] rounded-full transition-colors", i <= step ? "bg-primary" : "bg-surface-3")} />
            <span className={cn("text-[10.5px] mt-1.5 block", i <= step ? "text-muted" : "text-faint")}>{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Section title="First, a bit about you" subtitle="This is what every calorie number is built on.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <Input type="number" inputMode="numeric" placeholder="23" value={state.age ?? ""} onChange={(e) => set("age", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Sex">
              <Select value={state.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </Field>
          </div>

          <Field group label="Height">
            <div className="space-y-2">
              <SegmentedControl
                value={heightUnit}
                onChange={setHeightUnit}
                options={[
                  { value: "ft", label: "ft / in" },
                  { value: "cm", label: "cm" },
                ]}
              />
              {heightUnit === "ft" ? (
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="numeric" min={3} max={8} placeholder="5" value={feet} onChange={(e) => setHeightImperial(e.target.value, inches)} />
                  <span className="text-[13px] text-muted">ft</span>
                  <Input type="number" inputMode="numeric" min={0} max={11} placeholder="8" value={inches} onChange={(e) => setHeightImperial(feet, e.target.value)} />
                  <span className="text-[13px] text-muted">in</span>
                </div>
              ) : (
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="173"
                  value={state.heightCm ?? ""}
                  onChange={(e) => {
                    const cm = e.target.value ? Number(e.target.value) : null;
                    set("heightCm", cm);
                    setFeet(feetAndInches(cm).feet);
                    setInches(feetAndInches(cm).inches);
                  }}
                />
              )}
            </div>
          </Field>

          <Field label="Current weight (kg)">
            <Input type="number" inputMode="decimal" step="0.1" placeholder="90" value={state.weightKg ?? ""} onChange={(e) => set("weightKg", e.target.value ? Number(e.target.value) : null)} />
          </Field>
        </Section>
      )}

      {step === 1 && (
        <Section title="How active is your day?" subtitle="Work, walking and training are counted separately, so the estimate is honest.">
          <Field label="Your work or study day">
            <Select value={state.jobRole} onChange={(e) => set("jobRole", e.target.value)}>
              {JOBS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Training">
            <Select
              value={state.gymType}
              onChange={(e) => {
                set("gymType", e.target.value);
                if (e.target.value !== "none" && !state.gymDays) set("gymDays", 3);
                if (e.target.value === "none") set("gymDays", 0);
              }}
            >
              {GYMS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sessions per week">
              <Input type="number" inputMode="numeric" min={0} max={14} value={state.gymDays} onChange={(e) => set("gymDays", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Walking (min/day)" hint="Two 20-minute walks = 40">
              <Input type="number" inputMode="numeric" min={0} max={360} value={state.walkMinutes} onChange={(e) => set("walkMinutes", Number(e.target.value) || 0)} />
            </Field>
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section title="What are you going for?" subtitle="Give a target and a timeframe. Anything unsafe gets capped automatically.">
          <div className="flex flex-wrap gap-2">
            {GOALS.map(([value, label]) => (
              <Chip key={value} active={state.goalType === value} onClick={() => set("goalType", value)}>{label}</Chip>
            ))}
          </div>
          {state.goalType !== "maintain" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={state.goalType === "recomp" ? "Weight to hold near (kg)" : "Target weight (kg)"}>
                <Input type="number" inputMode="decimal" step="0.5" placeholder="75" value={state.targetWeight ?? ""} onChange={(e) => set("targetWeight", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="In how many weeks?" hint="24 weeks ≈ 6 months">
                <Input type="number" inputMode="numeric" min={2} max={104} value={state.targetWeeks} onChange={(e) => set("targetWeeks", Number(e.target.value) || 24)} />
              </Field>
            </div>
          )}
        </Section>
      )}

      {step === 3 && (
        <Section title="How you eat" subtitle="Used to tailor suggestions. You can change any of it later.">
          <Field group label="Diet">
            <div className="flex flex-wrap gap-2">
              {DIETS.map(([value, label]) => (
                <Chip key={value} active={state.dietType === value} onClick={() => set("dietType", value)}>{label}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Cuisines you actually eat">
            <Input value={state.cuisines} onChange={(e) => set("cuisines", e.target.value)} placeholder="indian, continental" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Allergies">
              <Input value={state.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="peanuts, lactose" />
            </Field>
            <Field label="Foods you dislike">
              <Input value={state.dislikes} onChange={(e) => set("dislikes", e.target.value)} placeholder="karela, mushrooms" />
            </Field>
          </div>
          <Field label="Anything else worth knowing" hint="Shapes AI suggestions. Not medical advice.">
            <Textarea value={state.extraInfo} onChange={(e) => set("extraInfo", e.target.value)} placeholder="Night shifts, hostel mess, PCOS, diabetes, tight budget…" />
          </Field>
        </Section>
      )}

      {step === 4 && targets && (
        <Section title="Your plan" subtitle="Built from your body, your work, your training and your walking.">
          <PlanSummary targets={targets} targetWeight={state.targetWeight} />
        </Section>
      )}

      <div className="flex items-center gap-2">
        {step > 0 && step < 4 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <Button variant="primary" onClick={next} loading={pending}>
            {step === 3 ? "Calculate my plan" : "Continue"} <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => router.push("/dashboard")}>
            <Check className="size-4" /> Start tracking
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5 animate-in">
      <div className="space-y-1">
        <h1 className="text-[21px] font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-[13.5px] text-muted text-pretty">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
