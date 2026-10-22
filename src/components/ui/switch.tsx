"use client";
import { cn } from "@/lib/utils";

/**
 * On/off switch with the original 36x20 look. The knob is placed with an
 * explicit `left` so it always stays inside the track.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative shrink-0 w-9 h-5 rounded-full transition-colors", checked ? "bg-kcal" : "bg-surface-3", className)}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-surface shadow transition-[left] duration-200",
          checked ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}
