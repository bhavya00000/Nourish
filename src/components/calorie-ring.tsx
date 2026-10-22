import { fmt } from "@/lib/utils";

/** The day's headline: how much is left, drawn as a single quiet arc. */
export function CalorieRing({ consumed, target, size = 150, stroke = 10 }: { consumed: number; target: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  const remaining = Math.round(target - consumed);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={over ? "stroke-danger" : "stroke-kcal"}
          style={{ transition: "stroke-dashoffset .5s cubic-bezier(.2,.8,.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[30px] font-semibold tnum leading-none tracking-tight">{fmt(Math.abs(remaining))}</div>
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-faint mt-1.5">
            {target ? (over ? "kcal over" : "kcal left") : "kcal eaten"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MacroBar({ label, value, target, tone }: { label: string; value: number; target: number; tone: "protein" | "carbs" | "fat" }) {
  const percent = target ? Math.min((value / target) * 100, 100) : 0;
  const colour = { protein: "bg-protein", carbs: "bg-carbs", fat: "bg-fat" }[tone];

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-muted">{label}</span>
        <span className="tnum">
          {fmt(value)}
          <span className="text-faint"> / {fmt(target)} g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full rounded-full ${colour} transition-[width] duration-500`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
