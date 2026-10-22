"use client";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-text hover:opacity-90 active:opacity-80",
  secondary: "bg-surface-2 text-text border border-border hover:bg-surface-3",
  outline: "border border-border text-text hover:bg-surface-2",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "border border-danger/30 text-danger hover:bg-danger/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-[15px] rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center font-medium transition-all select-none",
        "disabled:opacity-45 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-3.5 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
