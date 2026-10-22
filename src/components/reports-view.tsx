"use client";
import { useRouter } from "next/navigation";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Dumbbell, Flame } from "lucide-react";
import { Card, CardBody, CardHeader, Empty, Notice, Stat } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AdaptivePanel } from "@/components/adaptive-panel";
import { fmt, shortDate } from "@/lib/utils";
import type { reportSummary } from "@/lib/reports";

type Data = Awaited<ReturnType<typeof reportSummary>>;

const AXIS = { fontSize: 11, fill: "var(--text-faint)" };

export function ReportsView({ data, days }: { data: Data; days: number }) {
  const router = useRouter();
  const t = data.targets;

  return (
    <div className="space-y-4 animate-in">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Reports</h1>
          <p className="text-[13px] text-muted mt-0.5">What your log actually shows.</p>
        </div>
        <SegmentedControl
          value={String(days)}
          onChange={(value) => router.push(`/reports?days=${value}`)}
          options={[
            { value: "7", label: "7d" },
            { value: "30", label: "30d" },
            { value: "90", label: "90d" },
          ]}
        />
      </header>

      {!data.loggedDays ? (
        <Card>
          <CardBody className="pt-5">
            <Empty>Nothing logged in this period yet. Add a few meals and the reports fill in.</Empty>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat
              label="Avg intake"
              value={fmt(data.averages.kcal)}
              note={t ? `${data.averages.kcal - t.calories > 0 ? "+" : ""}${fmt(data.averages.kcal - t.calories)} vs target` : "kcal / day"}
            />
            <Stat label="Avg protein" value={`${fmt(data.averages.protein)} g`} note={t ? `target ${fmt(t.macros.protein)} g` : ""} tone="protein" />
            <Stat label="Days logged" value={`${data.loggedDays}/${days}`} note={`${data.adherence.missed} missed`} />
            <Stat
              label="Streak"
              value={
                <span className="flex items-center gap-1.5">
                  <Flame className="size-4 text-kcal" />
                  {data.streak}
                </span>
              }
              note={`day${data.streak === 1 ? "" : "s"} in a row`}
            />
          </div>

          <AdaptivePanel adaptive={data.adaptive} targets={t} />

          {data.training.sessions > 0 && <TrainingCard training={data.training} days={days} />}

          <Card>
            <CardHeader
              title="Calories per day"
              subtitle={t ? `Dashed line is your ${fmt(t.calories)} kcal target` : undefined}
            />
            <CardBody>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={22} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => fmt(Number(v))} />
                    <Tooltip content={<ChartTooltip unit="kcal" />} cursor={{ fill: "var(--surface-2)" }} />
                    {t && <ReferenceLine y={t.calories} stroke="var(--text-faint)" strokeDasharray="4 4" />}
                    <Bar dataKey="kcal" radius={[3, 3, 0, 0]} maxBarSize={26}>
                      {data.series.map((row) => (
                        <Cell
                          key={row.date}
                          fill={!row.items ? "var(--surface-3)" : t && row.kcal > t.calories * 1.1 ? "var(--danger)" : "var(--kcal)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {data.energyBalance && t && <BalanceNote data={data} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Macros per day" subtitle="Grams of protein, carbs and fat" />
            <CardBody>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={22} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => fmt(Number(v))} />
                    <Tooltip content={<ChartTooltip unit="g" />} cursor={{ fill: "var(--surface-2)" }} />
                    <Bar dataKey="protein" stackId="m" fill="var(--protein)" maxBarSize={26} />
                    <Bar dataKey="carbs" stackId="m" fill="var(--carbs)" maxBarSize={26} />
                    <Bar dataKey="fat" stackId="m" fill="var(--fat)" radius={[3, 3, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend items={[["Protein", "var(--protein)"], ["Carbs", "var(--carbs)"], ["Fat", "var(--fat)"]]} />
            </CardBody>
          </Card>

          {data.weights.length >= 2 && (
            <Card>
              <CardHeader
                title="Weight"
                subtitle={
                  data.actualKgPerWeek !== null
                    ? `${data.actualKgPerWeek > 0 ? "+" : ""}${fmt(data.actualKgPerWeek, 2)} kg per week measured${
                        data.energyBalance ? `, ${fmt(data.energyBalance.projectedKgPerWeek, 2)} predicted from intake` : ""
                      }`
                    : `${data.weights.length} weigh-ins`
                }
              />
              <CardBody>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.weights} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--kcal)" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="var(--kcal)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={22} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => fmt(Number(v), 1)} />
                      <Tooltip content={<ChartTooltip unit="kg" />} />
                      {t?.etaWeeks && <ReferenceLine y={data.weights[data.weights.length - 1].weightKg} stroke="transparent" />}
                      <Area type="monotone" dataKey="weightKg" stroke="var(--kcal)" strokeWidth={2} fill="url(#weightFill)" dot={{ r: 2.5, fill: "var(--kcal)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader title="Where your calories come from" />
              <CardBody className="space-y-3">
                {data.byMeal.map((meal) => {
                  const total = data.byMeal.reduce((a, m) => a + m.kcal, 0) || 1;
                  const percent = Math.round((meal.kcal / total) * 100);
                  return (
                    <div key={meal.meal} className="space-y-1.5">
                      <div className="flex justify-between text-[12.5px]">
                        <span className="capitalize text-muted">{meal.meal}</span>
                        <span className="tnum">
                          {fmt(meal.kcal)} <span className="text-faint">· {percent}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full bg-kcal" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
                {data.avgWindow !== null && data.avgWindow >= 0.5 && (
                  <p className="text-[12px] text-muted pt-1">
                    Your average eating window is {fmt(data.avgWindow, 1)} hours.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Consistency" subtitle="Hitting the target most days beats hitting it perfectly some days" />
              <CardBody className="space-y-3">
                {(
                  [
                    ["On target (±10%)", data.adherence.onTarget, "var(--kcal)"],
                    ["Under target", data.adherence.under, "var(--protein)"],
                    ["Over target", data.adherence.over, "var(--fat)"],
                    ["Not logged", data.adherence.missed, "var(--surface-3)"],
                  ] as const
                ).map(([label, value, colour]) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between text-[12.5px]">
                      <span className="text-muted">{label}</span>
                      <span className="tnum">
                        {value} day{value === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(value / days) * 100}%`, background: colour }} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Biggest calorie sources"
              subtitle={`Last ${days} days`}
              action={
                <Button variant="secondary" size="sm" onClick={() => window.open("/api/export?format=csv", "_blank")}>
                  <Download className="size-3.5" /> CSV
                </Button>
              }
            />
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.06em] text-faint">
                      <th className="text-left font-medium pb-2">Food</th>
                      <th className="text-right font-medium pb-2">Times</th>
                      <th className="text-right font-medium pb-2">Total kcal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFoods.map((food) => (
                      <tr key={food.name} className="border-t border-border">
                        <td className="py-2 pr-3">{food.name}</td>
                        <td className="py-2 text-right tnum text-muted">{food.times}</td>
                        <td className="py-2 text-right tnum">{fmt(food.kcal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function TrainingCard({ training, days }: { training: Data["training"]; days: number }) {
  const totalSets = training.byCategory.reduce((sum, row) => sum + row.sets, 0) || 1;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Dumbbell className="size-3.5 text-faint" />
            Training
          </span>
        }
        subtitle={`${training.sessions} session${training.sessions === 1 ? "" : "s"} over ${days} days — ${fmt(training.perWeek, 1)} per week`}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Burnt" value={fmt(training.kcal)} note="kcal total" tone="kcal" />
          <Stat label="Volume" value={fmt(training.volumeKg)} note="kg lifted" />
          <Stat label="Cardio" value={`${fmt(training.cardioMinutes)}m`} note="total" />
          <Stat label="Sets" value={fmt(training.strengthSets)} note="strength" />
        </div>

        <div className="space-y-3">
          {training.byCategory.map((row) => (
            <div key={row.category} className="space-y-1.5">
              <div className="flex justify-between text-[12.5px]">
                <span className="capitalize text-muted">{row.category}</span>
                <span className="tnum">
                  {row.sets} set{row.sets === 1 ? "" : "s"} <span className="text-faint">· {Math.round((row.sets / totalSets) * 100)}%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full rounded-full bg-protein" style={{ width: `${(row.sets / totalSets) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {training.topExercises.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-faint">
                  <th className="text-left font-medium pb-2">Exercise</th>
                  <th className="text-right font-medium pb-2">Sets</th>
                  <th className="text-right font-medium pb-2">Volume</th>
                </tr>
              </thead>
              <tbody>
                {training.topExercises.map((exercise) => (
                  <tr key={exercise.name} className="border-t border-border">
                    <td className="py-2 pr-3">{exercise.name}</td>
                    <td className="py-2 text-right tnum text-muted">{exercise.sets}</td>
                    <td className="py-2 text-right tnum">{fmt(exercise.volumeKg)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function BalanceNote({ data }: { data: Data }) {
  const b = data.energyBalance!;
  const t = data.targets!;
  const behind = b.dailyBalance > b.plannedDailyBalance + 120;
  const ahead = b.dailyBalance < b.plannedDailyBalance - 120;

  return (
    <div className="mt-3">
      <Notice tone={behind || ahead ? "warn" : "info"}>
        {behind ? (
          <>
            You are averaging <strong>{fmt(b.avgIntake)} kcal</strong> against a plan of {fmt(t.calories)}. That is a{" "}
            {fmt(Math.abs(b.dailyBalance))} kcal/day {b.dailyBalance < 0 ? "deficit" : "surplus"} rather than the{" "}
            {fmt(Math.abs(b.plannedDailyBalance))} you planned — progress will be slower, not absent.
          </>
        ) : ahead ? (
          <>
            You are running a deeper deficit than planned ({fmt(Math.abs(b.dailyBalance))} vs{" "}
            {fmt(Math.abs(b.plannedDailyBalance))} kcal/day). Fine briefly, but eating a little more usually keeps
            energy and training quality up.
          </>
        ) : (
          <>
            Tracking close to plan — averaging {fmt(b.avgIntake)} kcal against a {fmt(t.calories)} target.
          </>
        )}
      </Notice>
    </div>
  );
}

function Legend({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className="flex gap-4 mt-2 text-[11.5px] text-muted">
      {items.map(([label, colour]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: colour }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name?: string; dataKey?: string; value?: number; color?: string }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-pop)] px-3 py-2 text-[12px]">
      <div className="text-faint mb-1">{label ? shortDate(String(label)) : ""}</div>
      {payload.map((row) => (
        <div key={String(row.dataKey)} className="flex items-center gap-2 tnum">
          <span className="size-2 rounded-sm" style={{ background: row.color }} />
          <span className="capitalize text-muted">{String(row.dataKey)}</span>
          <span className="ml-auto font-medium">
            {fmt(Number(row.value), unit === "kg" ? 1 : 0)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
