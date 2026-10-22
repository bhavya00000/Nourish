"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "info" | "error" };
const ToastContext = createContext<(message: string, tone?: "info" | "error") => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: "info" | "error" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), tone === "error" ? 6000 : 3600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              // Toasts carry no controls, so they must never intercept a tap
              // meant for the page underneath.
              "animate-in pointer-events-none max-w-md w-full sm:w-auto rounded-xl border px-4 py-3 text-[13px]",
              "bg-surface shadow-[var(--shadow-pop)] text-pretty",
              toast.tone === "error" ? "border-danger/40" : "border-border"
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Small helper so dialogs can close on Escape without repeating the wiring. */
export function useEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, active]);
}
