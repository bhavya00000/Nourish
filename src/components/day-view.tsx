"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Copy, Droplet, Dumbbell, Flame, Pencil, Scale, Sparkles, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty, Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Chip } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CalorieRing, MacroBar } from "@/components/calorie-ring";
import { AddFoodBox } from "@/components/add-food-box";
import { PhotoLogger } from "@/components/photo-logger";
import { copyDayAction, deleteEntryAction, logWaterAction, logWeightAction, updateEntryAction } from "@/actions/log";
import { logRecipeAction } from "@/actions/recipes";
import { MEAL_META, fmt, prettyDate, qty, shiftDate, timeOfDay, todayISO } from "@/lib/utils";
import type { DaySummary } from "@/lib/tracker";

type Entry = DaySummary["entries"][number];

export function DayView({
  day,
  frequent,
  recipes,
  aiOn,
}: {
  day: DaySummary;
  frequent: { foodId: string; name: string; unit: string; quantity: number; times: number }[];
  recipes: { id: string; name: string; kind: string; meal: string | null }[];
  aiOn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [photoMeal, setPhotoMeal] = useState<string | null>(null);
  const [weighing, setWeighing] = useState(false);

  const targets = day.targets;
  const goTo = (date: string) => router.push(`/today?date=${date}`);

  return (
    <div className="space-y-4 animate-in">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => goTo(shiftDate(day.date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <h1 className="text-[17px] font-semibold tracking-tight min-w-24 sm:min-w-32 text-center">{prettyDate(day.date)}</h1>
          <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => goTo(shiftDate(day.date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {day.date !== todayISO() && (
            <Button size="sm" variant="ghost" onClick={() => goTo(todayISO())}>
              Today
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => router.push(`/train?date=${day.date}`)}>
            <Dumbbell className="size-3.5" /> Train
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setWeighing(true)}>
            <Scale className="size-3.5" /> Weigh in
          </Button>
        </div>
      </header>

      {!targets ? (
        <Card>
          <CardBody className="pt-5">
            <Empty>
              Finish your profile in <Link href="/settings" className="underline underline-offset-4">Settings</Link> to see targets.
            </Empty>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="pt-5 space-y-5">
            <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
              <CalorieRing consumed={day.totals.kcal} target={day.dayCalories} />
              <div className="flex-1 min-w-48 space-y-3.5">
                <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
                  <Figure label="Eaten" value={fmt(day.totals.kcal)} />
                  <Figure label="Target" value={fmt(day.dayCalories)} />
                  <Figure
                    label={day.remaining!.kcal < 0 ? "Over" : "Left"}
                    value={fmt(Math.abs(day.remaining!.kcal))}
                    tone={day.remaining!.kcal < 0 ? "danger" : "kcal"}
                  />
                </div>
                <MacroBar label="Protein" value={day.totals.protein} target={targets.macros.protein} tone="protein" />
                <MacroBar label="Carbs" value={day.totals.carbs} target={targets.macros.carbs} tone="carbs" />
                <MacroBar label="Fat" value={day.totals.fat} target={targets.macros.fat} tone="fat" />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
              <div className="flex-1 min-w-44 pt-3">
                <div className="flex items-baseline justify-between text-[12.5px] mb-1.5">
                  <span className="text-muted flex items-center gap-1.5">
                    <Droplet className="size-3.5" /> Water
                  </span>
                  <span className="tnum">
                    {(day.waterMl / 1000).toFixed(1)}
                    <span className="text-faint"> / {(targets.waterMl / 1000).toFixed(1)} L</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-water transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (day.waterMl / targets.waterMl) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-1.5 pt-3">
                {[250, 500].map((ml) => (
                  <Button
                    key={ml}
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await logWaterAction(day.date, ml);
                      router.refresh();
                    }}
                  >
                    +{ml}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove 250 ml"
                  onClick={async () => {
                    await logWaterAction(day.date, -250);
                    router.refresh();
                  }}
                >
                  −
                </Button>
              </div>
            </div>

            {day.training.kcal > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-border">
                <p className="text-[12.5px] text-muted flex items-center gap-1.5">
                  <Dumbbell className="size-3.5 shrink-0" />
                  {day.training.workouts.length} session{day.training.workouts.length > 1 ? "s" : ""} ·{" "}
                  {fmt(day.training.minutes)} min ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <Flame className="size-3" />
                    {fmt(day.training.kcal)} kcal burnt
                  </span>
                  {day.earnedKcal > 0 && <span className="text-kcal">· added to today&rsquo;s budget</span>}
                </p>
                <Link href="/train" className="text-[12.5px] underline underline-offset-4 text-muted hover:text-text">
                  Train
                </Link>
              </div>
            )}

            {day.window.hours > 0 && (
              <p className="text-[12px] text-muted flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" />
                Eating window {day.window.hours} h — first at {timeOfDay(day.window.first!)}, last at {timeOfDay(day.window.last!)}.
                {day.window.hours > 14 && " A tighter window often makes the deficit easier to hold."}
              </p>
            )}

            {day.remaining!.protein > 25 && day.totals.kcal > targets.calories * 0.55 && (
              <Notice>
                Still <strong>{fmt(day.remaining!.protein)} g of protein</strong> to go. Curd, eggs, paneer, dal or
                chicken are the cheapest ways to close that gap.
              </Notice>
            )}
          </CardBody>
        </Card>
      )}

      {(frequent.length > 0 || recipes.length > 0) && (
        <Card>
          <CardHeader title="Quick add" subtitle="Your usuals and saved meals, one tap each" />
          <CardBody className="flex flex-wrap gap-2">
            {recipes.map((recipe) => (
              <Chip
                key={recipe.id}
                onClick={async () => {
                  const result = await logRecipeAction({ recipeId: recipe.id, meal: recipe.meal ?? "lunch", date: day.date, servings: 1 });
                  if (result.error) return toast(result.error, "error");
                  toast(`Added ${recipe.name} · ${fmt(result.kcal ?? 0)} kcal`);
                  router.refresh();
                }}
              >
                <Utensils className="size-3 mr-1.5 inline" />
                {recipe.name}
              </Chip>
            ))}
            {frequent.map((food) => (
              <QuickAddChip key={`${food.foodId}-${food.unit}`} food={food} date={day.date} />
            ))}
          </CardBody>
        </Card>
      )}

      <div className="space-y-3">
        {MEAL_META.map((meal) => {
          const bucket = day.meals[meal.key];
          return (
            <Card key={meal.key}>
              <CardHeader
                title={meal.label}
                action={
                  <span className="text-[12.5px] text-muted tnum">
                    {bucket?.items ? `${fmt(bucket.kcal)} kcal · ${bucket.items} item${bucket.items > 1 ? "s" : ""}` : "—"}
                  </span>
                }
              />
              <CardBody className="space-y-2.5">
                {bucket?.entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onEdit={() => setEditing(entry)} />
                ))}
                <AddFoodBox
                  meal={meal.key}
                  date={day.date}
                  placeholder={meal.hint}
                  aiOn={aiOn}
                  onPhoto={aiOn ? () => setPhotoMeal(meal.key) : undefined}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardBody className="pt-5 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const result = await copyDayAction(shiftDate(day.date, -1), day.date);
              if (result.error) return toast(result.error, "error");
              toast(`Copied ${result.copied} items from yesterday`);
              router.refresh();
            }}
          >
            <Copy className="size-3.5" /> Copy yesterday
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="primary" onClick={() => router.push("/coach")}>
            <Sparkles className="size-3.5" /> What should I eat next?
          </Button>
        </CardBody>
      </Card>

      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} />
      <WeighInDialog open={weighing} onClose={() => setWeighing(false)} date={day.date} />
      {photoMeal && <PhotoLogger open onClose={() => setPhotoMeal(null)} date={day.date} defaultMeal={photoMeal} />}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "kcal" | "danger" }) {
  const colour = tone === "kcal" ? "text-kcal" : tone === "danger" ? "text-danger" : "";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.07em] text-faint font-medium">{label}</div>
      <div className={`text-[19px] font-semibold tnum leading-tight ${colour}`}>{value}</div>
    </div>
  );
}

function QuickAddChip({ food, date }: { food: { foodId: string; name: string; unit: string; quantity: number }; date: string }) {
  const router = useRouter();
  const toast = useToast();
  const [meal, setMeal] = useState<string | null>(null);

  return (
    <>
      <Chip onClick={() => setMeal("lunch")}>
        {food.name} · {qty(food.quantity)} {food.unit}
      </Chip>
      <Dialog open={Boolean(meal)} onClose={() => setMeal(null)} title={`Add ${food.name}`} description="Which meal?">
        <div className="flex flex-wrap gap-2">
          {MEAL_META.map((m) => (
            <Chip
              key={m.key}
              onClick={async () => {
                const { addEntryAction } = await import("@/actions/log");
                const result = await addEntryAction({ foodId: food.foodId, quantity: food.quantity, unit: food.unit, meal: m.key, date });
                setMeal(null);
                if (result.error) return toast(result.error, "error");
                toast(`Added ${food.name} · ${fmt(result.kcal ?? 0)} kcal`);
                router.refresh();
              }}
            >
              {m.label}
            </Chip>
          ))}
        </div>
      </Dialog>
    </>
  );
}

function EntryRow({ entry, onEdit }: { entry: Entry; onEdit: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);

  const badge = entry.source === "vision" ? "photo" : entry.source === "ai" ? "AI" : entry.source === "recipe" ? "recipe" : null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] truncate flex items-center gap-1.5">
          {entry.foodName}
          {badge && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-3 text-faint shrink-0">{badge}</span>
          )}
        </div>
        <div className="text-[11.5px] text-faint tnum">
          {qty(entry.quantity)} {entry.unit} · {fmt(entry.grams)} g · P {fmt(entry.protein)} · C {fmt(entry.carbs)} · F {fmt(entry.fat)}
        </div>
      </div>
      <span className="text-[13.5px] font-medium tnum shrink-0">{fmt(entry.kcal)}</span>
      <div className="flex gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${entry.foodName}`}>
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          loading={removing}
          aria-label={`Remove ${entry.foodName}`}
          onClick={async () => {
            setRemoving(true);
            const result = await deleteEntryAction(entry.id);
            setRemoving(false);
            if (result.error) return toast(result.error, "error");
            router.refresh();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EditEntryDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [meal, setMeal] = useState("");
  const [busy, setBusy] = useState(false);

  // Seed the form the first time a given entry opens.
  const [seeded, setSeeded] = useState<string | null>(null);
  if (entry && seeded !== entry.id) {
    setSeeded(entry.id);
    setQuantity(String(entry.quantity));
    setUnit(entry.unit);
    setMeal(entry.meal);
  }

  return (
    <Dialog open={Boolean(entry)} onClose={onClose} title={entry?.foodName ?? ""} description="Adjust the portion or move it to another meal.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <Input type="number" inputMode="decimal" step="0.25" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
        <Field label="Meal">
          <Select value={meal} onChange={(e) => setMeal(e.target.value)}>
            {MEAL_META.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!entry) return;
              setBusy(true);
              const result = await updateEntryAction({ id: entry.id, quantity: Number(quantity), unit: unit.trim(), meal });
              setBusy(false);
              if (result.error) return toast(result.error, "error");
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

function WeighInDialog({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const router = useRouter();
  const toast = useToast();
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="Log your weight" description="Same time each day is best — first thing in the morning is the most consistent.">
      <div className="space-y-4">
        <Field label="Weight (kg)">
          <Input type="number" inputMode="decimal" step="0.1" autoFocus value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="89.4" />
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
              const result = await logWeightAction(date, Number(weight));
              setBusy(false);
              if (result.error) return toast(result.error, "error");
              toast(
                result.learnedTdee
                  ? `Saved. Your measured maintenance is now ${fmt(result.learnedTdee)} kcal.`
                  : "Weight saved — targets refreshed."
              );
              setWeight("");
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
