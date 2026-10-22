import { fmt } from "@/lib/utils";
import { Notice } from "@/components/ui/card";
import type { Targets } from "@/lib/nutrition";

/** The shared "here is your plan" block, used by onboarding and settings. */
export function PlanSummary({ targets, targetWeight }: { targets: Targets; targetWeight?: number | null }) {
  const t = targets;
  const macroPercent = (grams: number, kcalPerGram: number) => Math.round(((grams * kcalPerGram) / t.calories) * 100);

  const rows = [
    ["Resting burn (BMR)", `${fmt(t.bmr)} kcal`],
    [`Daily living and work (×${t.jobMultiplier})`, `${fmt(t.base)} kcal`],
    ["Walking", `+${fmt(t.walk)} kcal`],
    ["Training, averaged over the week", `+${fmt(t.gym)} kcal`],
    ...(t.learnedTdee
      ? ([["Corrected by your own weight data", `${fmt(t.learnedTdee - t.formulaTdee)} kcal`]] as [string, string][])
      : []),
    ["Maintenance (TDEE)", `${fmt(t.tdee)} kcal`],
    [t.dailyDelta < 0 ? "Deficit applied" : t.dailyDelta > 0 ? "Surplus applied" : "No adjustment", `${t.dailyDelta > 0 ? "+" : ""}${fmt(t.dailyDelta)} kcal`],
  ] as [string, string][];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Metric label="Daily target" value={fmt(t.calories)} note="kcal / day" accent />
        <Metric label="Maintenance" value={fmt(t.tdee)} note="kcal / day" />
        <Metric
          label={t.dailyDelta < 0 ? "Deficit" : t.dailyDelta > 0 ? "Surplus" : "Balance"}
          value={fmt(Math.abs(t.dailyDelta))}
          note="kcal / day"
        />
        <Metric
          label="Rate"
          value={`${t.projectedKgPerWeek > 0 ? "+" : ""}${fmt(t.projectedKgPerWeek, 2)}`}
          note="kg / week"
        />
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold">Daily macros</h3>
          <span className="text-[12px] text-muted tnum">{fmt(t.calories)} kcal</span>
        </div>
        {(
          [
            ["Protein", t.macros.protein, 4, "bg-protein"],
            ["Carbs", t.macros.carbs, 4, "bg-carbs"],
            ["Fat", t.macros.fat, 9, "bg-fat"],
          ] as const
        ).map(([name, grams, kcalPerGram, colour]) => (
          <div key={name} className="space-y-1.5">
            <div className="flex justify-between text-[12.5px]">
              <span className="text-muted">{name}</span>
              <span className="tnum">
                {fmt(grams)} g<span className="text-faint"> · {macroPercent(grams, kcalPerGram)}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div className={`h-full rounded-full ${colour}`} style={{ width: `${macroPercent(grams, kcalPerGram)}%` }} />
            </div>
          </div>
        ))}
        <p className="text-[12px] text-muted pt-1">
          Also aim for about {fmt(t.fiberG)} g of fibre and {(t.waterMl / 1000).toFixed(1)} L of water a day.
        </p>
      </div>

      <details className="rounded-xl border border-border">
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-medium">How this was worked out</summary>
        <div className="px-4 pb-4">
          <table className="w-full text-[13px]">
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={label} className={i === rows.length - 2 || i === rows.length - 1 ? "font-medium" : ""}>
                  <td className="py-1.5 text-muted">{label}</td>
                  <td className="py-1.5 text-right tnum">{value}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t border-border">
                <td className="pt-2">Your daily target</td>
                <td className="pt-2 text-right tnum">{fmt(t.calories)} kcal</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      {t.notes.length > 0 && (
        <Notice tone="warn">
          <ul className="space-y-1">
            {t.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Notice>
      )}

      {t.etaWeeks && targetWeight ? (
        <Notice>
          At this rate you would reach <strong>{fmt(targetWeight, 1)} kg</strong> in about{" "}
          <strong>{t.etaWeeks} weeks</strong>
          {t.etaDate
            ? ` — around ${new Date(`${t.etaDate}T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
            : ""}
          . Weight moves in steps rather than a straight line; the weekly average is what matters.
        </Notice>
      ) : null}

      <p className="text-[12px] text-faint text-pretty">
        General guidance, not medical advice. Check with a doctor or dietitian if you have a health condition.
      </p>
    </div>
  );
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-[0.06em] text-faint font-medium">{label}</div>
      <div className={`text-[21px] font-semibold tnum leading-tight mt-0.5 ${accent ? "text-kcal" : ""}`}>{value}</div>
      <div className="text-[11.5px] text-muted">{note}</div>
    </div>
  );
}
