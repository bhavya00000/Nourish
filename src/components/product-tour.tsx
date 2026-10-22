"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markTourSeenAction } from "@/actions/profile";
import { cn } from "@/lib/utils";

const START_EVENT = "nourish:tour";

/** Replay the tour from anywhere — Settings → Get to know Nourish. */
export function startProductTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

/** `target` is a nav href; the link carrying data-tour={href} is spotlit. */
type Step = { target?: string; title: string; body: string };

const STEPS: Step[] = [
  {
    title: "Welcome to Nourish",
    body: "You log food and training the way you would say them, and every number is worked out for you. Here is a one-minute look around.",
  },
  {
    target: "/dashboard",
    title: "Home",
    body: "Your day at a glance: calories left, macros, steps, sleep, water, training and your weight against your goal. Tap any tile to edit it.",
  },
  {
    target: "/today",
    title: "Today — log what you eat",
    body: "Type it like you would say it: “2 roti and 1 katori dal”. Anything the database does not know is estimated by AI and saved for next time. You can also log from a photo, add a saved meal or copy yesterday.",
  },
  {
    target: "/train",
    title: "Train",
    body: "Workouts work the same way: “bench 3x8 60kg, running 20 min”. Calories burnt, personal bests and one-tap routines are handled for you.",
  },
  {
    target: "/reports",
    title: "Reports",
    body: "How the weeks are going: average intake, days on target and your real maintenance, learned from your weigh-ins. Measurements and achievements live in Progress.",
  },
  {
    target: "/coach",
    title: "Coach",
    body: "Ask what to eat next, plan a whole day, or what to train today. It reads what you have eaten and trained. It needs an AI key — add yours in Settings.",
  },
  {
    target: "/settings",
    title: "Settings",
    body: "Your goal, body details, AI key and syncing steps and sleep from your phone. Replay this tour any time from Settings → Get to know Nourish.",
  },
  {
    title: "You are all set",
    body: "The best way to start is to log your next meal. It takes a few seconds.",
  },
];

const CARD_WIDTH = 340;
const GAP = 14;

/** The visible copy of a nav link: the sidebar on desktop, the tab bar on a phone. */
function findTarget(href: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${href}"]`)].find((el) => el.getClientRects().length > 0) ?? null;
}

/** Beside the sidebar, above the tab bar, or below anything else. */
function placeCard(rect: DOMRect): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.right + GAP + CARD_WIDTH < vw && rect.left < vw / 3) {
    return { left: rect.right + GAP, top: Math.min(Math.max(16, rect.top - 24), vh - 300), width: CARD_WIDTH };
  }
  if (rect.top > vh / 2) return { left: 16, right: 16, bottom: vh - rect.top + GAP, marginInline: "auto", maxWidth: 420 };
  return { left: 16, right: 16, top: rect.bottom + GAP, marginInline: "auto", maxWidth: 420 };
}

export function ProductTour({ name, autoStart }: { name: string; autoStart: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const current = step === null ? null : STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (autoStart) setStep(0);
    const start = () => setStep(0);
    window.addEventListener(START_EVENT, start);
    return () => window.removeEventListener(START_EVENT, start);
  }, [autoStart]);

  const close = useCallback(
    (then?: string) => {
      setStep(null);
      markTourSeenAction().catch(() => {});
      if (then) router.push(then);
    },
    [router]
  );

  // Follow the spotlit link through resizes and rotation.
  useLayoutEffect(() => {
    if (!current?.target) return setRect(null);
    const target = current.target;
    const measure = () => setRect(findTarget(target)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current]);

  useEffect(() => {
    if (step === null) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && !last) setStep((s) => (s ?? 0) + 1);
      else if (e.key === "ArrowLeft" && step > 0) setStep((s) => (s ?? 1) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, close]);

  if (step === null || !current || typeof document === "undefined") return null;

  const pad = 6;
  const title = step === 0 ? `Welcome to Nourish, ${name.split(" ")[0]}` : current.title;

  return createPortal(
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Blocks the page while touring; the spotlight's shadow does the dimming. */}
      <div className={cn("absolute inset-0", !rect && "bg-black/55 backdrop-blur-[2px]")} />
      {rect && (
        <div
          aria-hidden
          className="absolute rounded-xl ring-2 ring-primary transition-all duration-300 pointer-events-none"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={cn(
          "animate-pop bg-surface border border-border rounded-2xl shadow-[var(--shadow-pop)] p-5 space-y-3",
          rect ? "absolute" : "absolute inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-md"
        )}
        style={rect ? placeCard(rect) : undefined}
      >
        <p className="text-[11.5px] font-medium text-faint tnum">
          {step + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className="text-[16px] font-semibold tracking-tight text-pretty">
          {title}
        </h2>
        <p className="text-[13.5px] text-muted text-pretty leading-relaxed">{current.body}</p>

        <div className="flex gap-1 pt-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-surface-3")} />
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          {!last && (
            <Button variant="ghost" size="sm" onClick={() => close()}>
              Skip tour
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {last ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => close()}>
                  Done
                </Button>
                <Button ref={primaryRef} variant="primary" size="sm" onClick={() => close("/today")}>
                  Log a meal
                </Button>
              </>
            ) : (
              <Button ref={primaryRef} variant="primary" size="sm" onClick={() => setStep(step + 1)}>
                {step === 0 ? "Show me around" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
