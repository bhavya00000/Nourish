"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, ClipboardList, Dumbbell, HeartPulse, House, LineChart, LogOut, Search, Settings, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/actions/auth";

/** Everything, for the desktop sidebar. */
const LINKS = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/today", label: "Today", icon: ClipboardList },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings/health", label: "Health data", icon: HeartPulse },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** The phone tab bar keeps its original six slots. */
const TABS = ["/dashboard", "/today", "/train", "/reports", "/coach", "/settings"];

export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    // A more specific sidebar entry wins: "Settings" is not lit on "Health data".
    return !LINKS.some((l) => l.href !== href && l.href.startsWith(`${href}/`) && (pathname === l.href || pathname.startsWith(`${l.href}/`)));
  };

  // On a phone, pages without their own tab light up the tab they are reached from.
  const tabFor = (href: string) =>
    isActive(href) ||
    (href === "/settings" && ["/settings/health", "/recipes", "/search"].some((p) => pathname.startsWith(p))) ||
    (href === "/dashboard" && pathname.startsWith("/progress"));

  return (
    <>
      {/* Desktop: a quiet sidebar. */}
      <aside className="hidden lg:flex flex-col gap-1 border-r border-border px-3 py-6 sticky top-0 h-dvh">
        <Link href="/dashboard" className="flex items-center gap-2 px-2.5 pb-5 font-semibold tracking-tight">
          <span className="grid place-items-center size-7 rounded-lg bg-primary text-primary-text text-[13px]">N</span>
          Nourish
        </Link>

        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            data-tour={href}
            className={cn(
              "flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13.5px] font-medium transition-colors",
              isActive(href) ? "bg-surface-2 text-text" : "text-muted hover:text-text hover:bg-surface-2/60"
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
            {label}
          </Link>
        ))}

        <div className="mt-auto space-y-3 px-1">
          <ThemeToggle />
          <div className="flex items-center justify-between gap-2 px-1.5">
            <span className="text-[12.5px] text-muted truncate">{userName}</span>
            <form action={logout}>
              <button type="submit" aria-label="Sign out" className="text-faint hover:text-text transition-colors p-1">
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile: a compact top bar plus a bottom tab bar. */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-bg/85 backdrop-blur-md border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-[15px]">
          <span className="grid place-items-center size-6 rounded-md bg-primary text-primary-text text-[11px]">N</span>
          Nourish
        </Link>
        <ThemeToggle />
      </header>

      <nav aria-label="Primary" className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bg/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {LINKS.filter((l) => TABS.includes(l.href)).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-tour={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[9.5px] font-medium transition-colors",
                tabFor(href) ? "text-text" : "text-faint"
              )}
            >
              <Icon className="size-[17px]" strokeWidth={2} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
