"use client";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscape } from "./toast";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEscape(onClose, open);

  useEffect(() => {
    if (!open) return;
    // Stop the page scrolling behind the dialog.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-pop bg-surface border border-border w-full ${wide ? "sm:max-w-xl" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-pop)] max-h-[92dvh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-[13px] text-muted mt-0.5 text-pretty">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
