import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("bg-surface border border-border rounded-card shadow-[var(--shadow-card)]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted mt-0.5 text-balance">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "kcal" | "protein" | "danger" | "muted" }) {
  const color =
    tone === "kcal" ? "text-kcal" : tone === "protein" ? "text-protein" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.07em] text-faint font-medium">{label}</div>
      <div className={cn("text-[22px] font-semibold tnum leading-tight mt-1", color)}>{value}</div>
      {note && <div className="text-[12px] text-muted mt-0.5">{note}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-faint text-center py-6 text-balance">{children}</p>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger"; children: ReactNode }) {
  const styles = {
    info: "bg-success/8 border-success/25 text-text",
    warn: "bg-warning/10 border-warning/30 text-text",
    danger: "bg-danger/8 border-danger/25 text-text",
  }[tone];
  return <div className={cn("border rounded-xl px-3.5 py-3 text-[13px] leading-relaxed text-pretty", styles)}>{children}</div>;
}
