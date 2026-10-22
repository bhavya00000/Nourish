"use client";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL =
  "w-full bg-surface-2 border border-border rounded-xl px-3.5 h-10 text-sm transition-colors " +
  "placeholder:text-faint hover:border-border-strong focus:border-primary focus:outline-none " +
  "focus:ring-4 focus:ring-[var(--ring)]";

/**
 * A labelled form row.
 *
 * `group` matters for accessibility: a <label> implicitly names its first
 * labelable descendant, so wrapping a set of chips in one would give the first
 * chip the entire group's text as its accessible name and leave the rest
 * unlabelled. Groups get a role="group" with an aria-label instead.
 */
export function Field({
  label,
  hint,
  children,
  className,
  group,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  group?: boolean;
}) {
  const body = (
    <>
      {label && <span className="text-[12px] font-medium text-muted">{label}</span>}
      {children}
      {hint && <span className="text-[11.5px] text-faint leading-snug">{hint}</span>}
    </>
  );

  if (group) {
    return (
      <div
        role="group"
        aria-label={typeof label === "string" ? label : undefined}
        className={cn("flex flex-col gap-1.5", className)}
      >
        {body}
      </div>
    );
  }

  return <label className={cn("flex flex-col gap-1.5", className)}>{body}</label>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "h-auto min-h-20 py-2.5 resize-y leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(CONTROL, "appearance-none pr-9 cursor-pointer", className)}>
        {children}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-faint pointer-events-none" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Chip({ active, className, children, ...props }: InputHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...(props as object)}
      className={cn(
        "px-3 h-8 rounded-full text-[13px] font-medium border transition-all",
        active
          ? "bg-primary text-primary-text border-primary"
          : "bg-surface-2 text-muted border-border hover:border-border-strong hover:text-text",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex bg-surface-2 border border-border rounded-xl p-1 gap-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 h-7 rounded-lg text-[13px] font-medium transition-all",
            value === option.value ? "bg-surface text-text shadow-[var(--shadow-card)]" : "text-muted hover:text-text"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
