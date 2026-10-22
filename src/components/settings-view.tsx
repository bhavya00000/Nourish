"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Compass, Download, HeartPulse, LineChart, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty, Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Chip, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { PlanSummary } from "@/components/plan-summary";
import { AiSettingsCard } from "@/components/ai-settings-card";
import { startProductTour } from "@/components/product-tour";
import { Switch } from "@/components/ui/switch";
import { previewTargets, updateGoal, updateProfile } from "@/actions/profile";
import { deleteAccountAction, deleteFoodAction } from "@/actions/account";
import { logout } from "@/actions/auth";
import { cn, fmt } from "@/lib/utils";
import type { Targets } from "@/lib/nutrition";

const JOBS = [["desk", "Desk job or student"], ["standing", "On my feet"], ["field", "Moving all day"], ["labour", "Physical work"]] as const;
const GYMS = [["none", "Not training"], ["weights", "Weights"], ["cardio", "Cardio"], ["mixed", "Weights and cardio"], ["yoga", "Yoga or pilates"], ["sports", "Sports"]] as const;
const GOALS = [["lose", "Lose weight"], ["gain", "Gain weight"], ["recomp", "Build muscle"], ["maintain", "Maintain"]] as const;
const DIETS = [["veg", "Vegetarian"], ["eggetarian", "Eggetarian"], ["nonveg", "Non-vegetarian"], ["vegan", "Vegan"]] as const;

type Profile = Record<string, string | number | boolean | null>;
type Goal = Record<string, string | number | null>;
type Food = { id: string; name: string; kcal: number; protein: number; units: string; source: string };

export function SettingsView({
  user, profile, goal, targets, foods, aiSettings, health,
}: {
  health: { source: string; syncedAt: string } | null;
  user: { name: string; email: string };
  profile: Profile;
  goal: Goal;
  targets: Targets | null;
  foods: Food[];
  aiSettings: React.ComponentProps<typeof AiSettingsCard>["settings"];
}) {
  return (
    <div className="space-y-4 animate-in">
      <header>
        <h1 className="text-[17px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[13px] text-muted mt-0.5">Signed in as {user.email}</p>
      </header>

      {targets && (
        <Card>
          <CardHeader title="Your plan" subtitle="Recalculated whenever you change anything below" />
          <CardBody>
            <PlanSummary targets={targets} targetWeight={goal?.targetWeight as number | null} />
          </CardBody>
        </Card>
      )}

      <GoalCard goal={goal} />
      <BodyCard profile={profile} />
      <MoreLinksCard />
      <HealthLinkCard health={health} />
      <TourCard />
      <TrainingIntegrationCard profile={profile} />
      <AiSettingsCard settings={aiSettings} />
      <FoodPrefsCard profile={profile} />
      <MyFoodsCard foods={foods} />
      <AccountCard />
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const router = useRouter();
  const toast = useToast();
  const [goalType, setGoalType] = useState(String(goal?.goalType ?? "maintain"));
  const [targetWeight, setTargetWeight] = useState(String(goal?.targetWeight ?? ""));
  const [targetWeeks, setTargetWeeks] = useState(String(goal?.targetWeeks ?? 24));
  const [customCalories, setCustomCalories] = useState(String(goal?.customCalories ?? ""));
  const [preview, setPreview] = useState<Targets | null>(null);
  const [pending, startTransition] = useTransition();

  // Live preview so the effect of a change is visible before saving it.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await previewTargets({
        goal: {
          goalType,
          targetWeight: goalType === "maintain" ? null : Number(targetWeight) || null,
          targetWeeks: Number(targetWeeks) || 24,
          customCalories: Number(customCalories) || null,
        },
      });
      setPreview(result);
    }, 350);
    return () => clearTimeout(timer);
  }, [goalType, targetWeight, targetWeeks, customCalories]);

  return (
    <Card>
      <CardHeader title="Goal" subtitle="Change it whenever your plans change" />
      <CardBody className="space-y-3.5">
        <div className="flex flex-wrap gap-2">
          {GOALS.map(([value, label]) => (
            <Chip key={value} active={goalType === value} onClick={() => setGoalType(value)}>
              {label}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {goalType !== "maintain" && (
            <>
              <Field label="Target weight (kg)">
                <Input type="number" inputMode="decimal" step="0.5" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
              </Field>
              <Field label="Weeks">
                <Input type="number" inputMode="numeric" min={2} max={104} value={targetWeeks} onChange={(e) => setTargetWeeks(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Override calories" hint="Leave blank for automatic">
            <Input type="number" inputMode="numeric" placeholder="auto" value={customCalories} onChange={(e) => setCustomCalories(e.target.value)} />
          </Field>
        </div>

        {preview && (
          <Notice>
            <strong className="tnum">{fmt(preview.calories)} kcal/day</strong> · {fmt(preview.macros.protein)} g protein ·{" "}
            {preview.projectedKgPerWeek > 0 ? "+" : ""}
            {fmt(preview.projectedKgPerWeek, 2)} kg/week
            {preview.etaWeeks ? ` · target in about ${preview.etaWeeks} weeks` : ""}
            {preview.notes.length > 0 && <div className="text-[12px] text-muted mt-1">{preview.notes.join(" ")}</div>}
          </Notice>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateGoal({
                  goalType,
                  targetWeight: goalType === "maintain" ? null : Number(targetWeight) || null,
                  targetWeeks: Number(targetWeeks) || 24,
                  customCalories: Number(customCalories) || null,
                });
                if (result?.error) return toast(result.error, "error");
                toast("Goal updated");
                router.refresh();
              })
            }
          >
            Save goal
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function BodyCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    age: String(profile?.age ?? ""),
    sex: String(profile?.sex ?? "male"),
    heightCm: String(profile?.heightCm ?? ""),
    weightKg: String(profile?.weightKg ?? ""),
    jobRole: String(profile?.jobRole ?? "desk"),
    gymType: String(profile?.gymType ?? "none"),
    gymDays: String(profile?.gymDays ?? 0),
    walkMinutes: String(profile?.walkMinutes ?? 0),
  });
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card>
      <CardHeader title="Body and activity" subtitle="Saving here recalculates your targets" />
      <CardBody className="space-y-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Age">
            <Input type="number" inputMode="numeric" value={form.age} onChange={(e) => set("age", e.target.value)} />
          </Field>
          <Field label="Sex">
            <Select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
          <Field label="Height (cm)">
            <Input type="number" inputMode="numeric" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
          </Field>
          <Field label="Weight (kg)">
            <Input type="number" inputMode="decimal" step="0.1" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Work or study day">
            <Select value={form.jobRole} onChange={(e) => set("jobRole", e.target.value)}>
              {JOBS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Training">
            <Select value={form.gymType} onChange={(e) => set("gymType", e.target.value)}>
              {GYMS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sessions per week">
            <Input type="number" inputMode="numeric" min={0} max={14} value={form.gymDays} onChange={(e) => set("gymDays", e.target.value)} />
          </Field>
          <Field label="Walking (min/day)">
            <Input type="number" inputMode="numeric" min={0} max={360} value={form.walkMinutes} onChange={(e) => set("walkMinutes", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateProfile({
                  age: Number(form.age), sex: form.sex, heightCm: Number(form.heightCm), weightKg: Number(form.weightKg),
                  jobRole: form.jobRole, gymType: form.gymType, gymDays: Number(form.gymDays), walkMinutes: Number(form.walkMinutes),
                });
                if (result?.error) return toast(result.error, "error");
                toast("Saved — targets recalculated");
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

/** Phones only: the sidebar covers these on desktop. */
function MoreLinksCard() {
  const links = [
    { href: "/progress", label: "Progress", note: "Measurements, review and achievements", icon: LineChart },
    { href: "/recipes", label: "Recipes", note: "Saved meals and dishes", icon: BookOpen },
    { href: "/search", label: "Search", note: "Everything you have logged", icon: Search },
  ];
  return (
    <Card className="lg:hidden">
      <CardBody className="pt-3 pb-3 divide-y divide-border">
        {links.map(({ href, label, note, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 py-2.5 group">
            <Icon className="size-4 text-muted shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{label}</span>
              <span className="block text-[12px] text-muted truncate">{note}</span>
            </span>
            <ChevronRight className="size-4 text-faint shrink-0 group-hover:text-text" />
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

function HealthLinkCard({ health }: { health: { source: string; syncedAt: string } | null }) {
  return (
    <Link href="/settings/health" className="block group">
      <Card className="transition-colors group-hover:border-border-strong">
        <CardBody className="pt-5 flex items-center gap-3">
          <span className={cn("grid place-items-center size-10 rounded-xl shrink-0", health ? "bg-kcal/12 text-kcal" : "bg-surface-2 text-muted")}>
            <HeartPulse className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">Health data</span>
            <span className="block text-[12.5px] text-muted truncate">
              {health
                ? `Connected · ${health.source} · last sync ${new Date(health.syncedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                : "Sync steps, sleep, energy and workouts from Apple Health or Health Connect"}
            </span>
          </span>
          <ChevronRight className="size-4 text-faint shrink-0" />
        </CardBody>
      </Card>
    </Link>
  );
}

/** Replays the first-visit tour. */
function TourCard() {
  return (
    <button type="button" onClick={startProductTour} className="block w-full text-left group">
      <Card className="transition-colors group-hover:border-border-strong">
        <CardBody className="pt-5 flex items-center gap-3">
          <span className="grid place-items-center size-10 rounded-xl shrink-0 bg-surface-2 text-muted">
            <Compass className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">Get to know Nourish</span>
            <span className="block text-[12.5px] text-muted truncate">A one-minute tour of what is where</span>
          </span>
          <ChevronRight className="size-4 text-faint shrink-0" />
        </CardBody>
      </Card>
    </button>
  );
}

/** Feature: choose whether training is an estimate or comes from the log. */
function TrainingIntegrationCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(Boolean(profile?.useLoggedWorkouts));
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="Training and calories"
        subtitle="How your workouts feed into your daily target"
        action={
          <Switch
            checked={enabled}
            label="Use logged workouts"
            disabled={pending}
            onChange={(next) => {
              setEnabled(next);
              startTransition(async () => {
                const result = await updateProfile({ useLoggedWorkouts: next });
                if (result?.error) return toast(result.error, "error");
                toast(next ? "Your target now follows what you actually train." : "Back to a weekly training estimate.");
                router.refresh();
              });
            }}
          />
        }
      />
      <CardBody>
        <p className="text-[13px] text-muted text-pretty">
          {enabled
            ? "Your baseline no longer assumes an average week of training. Instead, each day's real activity adjusts that day's food budget — measured active energy from a watch when you sync one, otherwise the workouts and steps you log. Rest days are leaner; hard days give you more to eat."
            : "Your target assumes an average week of training, spread evenly across all seven days. Turn this on to use what you actually log instead, day by day."}
        </p>
        <p className="text-[12px] text-faint mt-2 text-pretty">
          Only one of the two is ever counted, so your training is never double counted.
        </p>
      </CardBody>
    </Card>
  );
}

function FoodPrefsCard({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [dietType, setDietType] = useState(String(profile?.dietType ?? "veg"));
  const [cuisines, setCuisines] = useState(String(profile?.cuisines ?? ""));
  const [allergies, setAllergies] = useState(String(profile?.allergies ?? ""));
  const [dislikes, setDislikes] = useState(String(profile?.dislikes ?? ""));
  const [extraInfo, setExtraInfo] = useState(String(profile?.extraInfo ?? ""));
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader title="Food preferences" subtitle="Shapes every AI suggestion" />
      <CardBody className="space-y-3.5">
        <Field group label="Diet">
          <div className="flex flex-wrap gap-2">
            {DIETS.map(([value, label]) => (
              <Chip key={value} active={dietType === value} onClick={() => setDietType(value)}>
                {label}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Cuisines">
            <Input value={cuisines} onChange={(e) => setCuisines(e.target.value)} placeholder="indian, chinese" />
          </Field>
          <Field label="Allergies">
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="peanuts" />
          </Field>
          <Field label="Dislikes">
            <Input value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="karela" />
          </Field>
        </div>
        <Field label="Anything else">
          <Textarea value={extraInfo} onChange={(e) => setExtraInfo(e.target.value)} placeholder="hostel mess, night shifts, budget, medical notes" />
        </Field>
        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateProfile({ dietType, cuisines, allergies, dislikes, extraInfo });
                if (result?.error) return toast(result.error, "error");
                toast("Preferences saved");
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

function MyFoodsCard({ foods }: { foods: Food[] }) {
  const router = useRouter();
  const toast = useToast();

  return (
    <Card>
      <CardHeader title="My foods" subtitle={`${foods.length} saved — anything you added, or the AI estimated for you`} />
      <CardBody className="space-y-2">
        {foods.length === 0 && <Empty>Nothing yet. Log a food that is not in the list and it will appear here.</Empty>}
        {foods.map((food) => (
          <div key={food.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] truncate flex items-center gap-1.5">
                {food.name}
                {food.source !== "custom" && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-3 text-faint">
                    {food.source === "vision" ? "photo" : food.source}
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-faint tnum">
                {fmt(food.kcal)} kcal / 100 g · P {fmt(food.protein)} · 1 {food.units.split("|")[0].split(":")[0]} ={" "}
                {food.units.split("|")[0].split(":")[1]} g
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${food.name}`}
              onClick={async () => {
                await deleteFoodAction(food.id);
                toast(`Deleted ${food.name}`);
                router.refresh();
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function AccountCard() {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader title="Your data" subtitle="It is yours — take it or delete it at any time" />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.open("/api/export?format=json", "_blank")}>
            <Download className="size-3.5" /> Export everything (JSON)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open("/api/export?format=csv", "_blank")}>
            <Download className="size-3.5" /> Entries (CSV)
          </Button>
          <div className="flex-1" />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12.5px] text-muted text-pretty">
            Deleting your account removes every entry, weigh-in, recipe and saved food. It cannot be undone.
          </p>
          <Button variant="danger" size="sm" onClick={() => setDeleting(true)}>
            Delete account
          </Button>
        </div>

        <Dialog
          open={deleting}
          onClose={() => setDeleting(false)}
          title="Delete your account"
          description="Everything goes, permanently. Enter your password to confirm."
        >
          <div className="space-y-4">
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await deleteAccountAction(password);
                  setBusy(false);
                  if (result?.error) toast(result.error, "error");
                }}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </Dialog>
      </CardBody>
    </Card>
  );
}
