"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Empty, Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Chip, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createRecipeAction, deleteRecipeAction, logRecipeAction } from "@/actions/recipes";
import { MEAL_META, fmt, qty, todayISO } from "@/lib/utils";

type Recipe = NonNullable<Awaited<ReturnType<typeof import("@/actions/recipes").recipeTotals>>>;

export function RecipesView({ recipes }: { recipes: Recipe[] }) {
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<Recipe | null>(null);

  return (
    <div className="space-y-4 animate-in">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Recipes &amp; meals</h1>
          <p className="text-[13px] text-muted mt-0.5 text-pretty">
            Build a dish or a usual meal once, then log the whole thing in one tap.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> New
        </Button>
      </header>

      {recipes.length === 0 ? (
        <Card>
          <CardBody className="pt-5">
            <Empty>
              Nothing saved yet. A recipe is just a list like &ldquo;3 roti, 1 katori dal, 150 g curd&rdquo; — give it a
              name and it becomes one tap on the Today tab.
            </Empty>
          </CardBody>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.recipe.id} recipe={recipe} onLog={() => setLogging(recipe)} />
          ))}
        </div>
      )}

      <CreateRecipeDialog open={creating} onClose={() => setCreating(false)} />
      <LogRecipeDialog recipe={logging} onClose={() => setLogging(null)} />
    </div>
  );
}

function RecipeCard({ recipe, onLog }: { recipe: Recipe; onLog: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);
  const { recipe: meta, perServing, lines } = recipe;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Utensils className="size-3.5 text-faint" />
            {meta.name}
          </span>
        }
        subtitle={`${meta.kind === "recipe" ? "Recipe" : "Saved meal"}${meta.servings > 1 ? ` · ${qty(meta.servings)} servings` : ""}`}
        action={
          <Button
            variant="ghost"
            size="icon"
            loading={removing}
            aria-label={`Delete ${meta.name}`}
            onClick={async () => {
              setRemoving(true);
              await deleteRecipeAction(meta.id);
              toast(`Deleted ${meta.name}`);
              router.refresh();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex gap-4 text-[12.5px] tnum">
          <span>
            <strong className="text-[15px]">{fmt(perServing.kcal)}</strong> <span className="text-faint">kcal</span>
          </span>
          <span className="text-muted">P {fmt(perServing.protein)}</span>
          <span className="text-muted">C {fmt(perServing.carbs)}</span>
          <span className="text-muted">F {fmt(perServing.fat)}</span>
          {meta.servings > 1 && <span className="text-faint">per serving</span>}
        </div>

        <ul className="text-[12.5px] text-muted space-y-0.5">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span className="truncate">
                {qty(line.quantity)} {line.unit} {line.name}
              </span>
              <span className="tnum text-faint shrink-0">{fmt(line.kcal)}</span>
            </li>
          ))}
        </ul>

        <Button variant="secondary" size="sm" className="w-full" onClick={onLog}>
          Log this
        </Button>
      </CardBody>
    </Card>
  );
}

function CreateRecipeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [kind, setKind] = useState("template");
  const [meal, setMeal] = useState("breakfast");
  const [servings, setServings] = useState("1");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New recipe or saved meal"
      description="Write the ingredients the same way you log food."
      wide
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My usual breakfast" />
          </Field>
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="template">Saved meal — log as-is</option>
              <option value="recipe">Recipe — cooked, makes several servings</option>
            </Select>
          </Field>
        </div>

        <Field label="Ingredients" hint="One line or comma separated, e.g. “3 roti, 1 katori dal, 150 g curd”.">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="3 roti, 1 katori dal, 150 g curd, 1 cup chai" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Usual meal">
            <Select value={meal} onChange={(e) => setMeal(e.target.value)}>
              {MEAL_META.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Servings it makes" hint={kind === "recipe" ? "Totals are divided by this." : "Usually 1."}>
            <Input type="number" inputMode="decimal" step="0.5" min="0.5" value={servings} onChange={(e) => setServings(e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await createRecipeAction({ name, text, kind, meal, servings: Number(servings) || 1 });
              setBusy(false);
              if (result.error) return toast(result.error, "error");
              if (result.skipped?.length) toast(`Saved, but these were not recognised: ${result.skipped.join(", ")}`, "error");
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

function LogRecipeDialog({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [servings, setServings] = useState("1");
  const [busy, setBusy] = useState(false);

  if (!recipe) return null;
  const kcal = Math.round(recipe.perServing.kcal * (Number(servings) || 1));

  return (
    <Dialog open onClose={onClose} title={`Log ${recipe.recipe.name}`} description="Every ingredient is logged separately, so you can still edit them.">
      <div className="space-y-4">
        <Field label="Servings">
          <Input type="number" inputMode="decimal" step="0.5" min="0.5" value={servings} onChange={(e) => setServings(e.target.value)} />
        </Field>
        <Notice>
          That is <strong>{fmt(kcal)} kcal</strong> and {fmt(recipe.perServing.protein * (Number(servings) || 1))} g of protein.
        </Notice>
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-muted">Add to</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_META.map((m) => (
              <Chip
                key={m.key}
                active={recipe.recipe.meal === m.key}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await logRecipeAction({
                    recipeId: recipe.recipe.id,
                    meal: m.key,
                    date: todayISO(),
                    servings: Number(servings) || 1,
                  });
                  setBusy(false);
                  if (result.error) return toast(result.error, "error");
                  toast(`Added ${result.name} · ${fmt(result.kcal ?? 0)} kcal`);
                  onClose();
                  router.refresh();
                }}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
