"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server cannot know the user's theme, so render the control only after
  // hydration to avoid a mismatched icon flashing.
  useEffect(() => setMounted(true), []);

  return (
    <div className="inline-flex items-center gap-0.5 bg-surface-2 border border-border rounded-lg p-0.5" role="group" aria-label="Colour theme">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={label}
          aria-pressed={mounted ? theme === value : undefined}
          className={cn(
            "grid place-items-center size-7 rounded-md transition-all",
            mounted && theme === value ? "bg-surface text-text shadow-[var(--shadow-card)]" : "text-faint hover:text-text"
          )}
        >
          <Icon className="size-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
