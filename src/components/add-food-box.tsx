"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CornerDownLeft, Sparkles } from "lucide-react";
import { Button, Spinner } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addEntryAction, logTextAction } from "@/actions/log";
import { cn, fmt } from "@/lib/utils";

type Suggestion = {
  id: string; name: string; source: string; quantity: number; unit: string; kcal: number; protein: number; grams: number;
};

export function AddFoodBox({
  meal,
  date,
  placeholder,
  aiOn,
  onPhoto,
}: {
  meal: string;
  date: string;
  placeholder: string;
  aiOn: boolean;
  onPhoto?: () => void;
}) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  // Debounced type-ahead. The request is aborted when the user keeps typing.
  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results ?? []);
        setCursor(-1);
        setOpen((data.results ?? []).length > 0);
      } catch {
        /* aborted or offline — the free-text path still works */
      }
    }, 170);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  async function submitText() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setOpen(false);

    const result = await logTextAction({ text: value, meal, date });
    setBusy(false);

    if (result.error) return toast(result.error, "error");

    if (result.added) {
      const aiNote = result.aiAdded.length ? ` · ${result.aiAdded.length} estimated by AI` : "";
      toast(`Added ${result.added} item${result.added > 1 ? "s" : ""} · ${fmt(result.kcal)} kcal${aiNote}`);
      setText("");
      router.refresh();
    }
    for (const failure of result.failed) toast(`“${failure.phrase}” — ${failure.reason}`, "error");
  }

  async function pick(suggestion: Suggestion) {
    setBusy(true);
    setOpen(false);
    const result = await addEntryAction({
      foodId: suggestion.id,
      quantity: suggestion.quantity,
      unit: suggestion.unit,
      meal,
      date,
      rawText: text.trim(),
    });
    setBusy(false);

    if (result.error) return toast(result.error, "error");
    toast(`Added ${result.name} · ${fmt(result.kcal ?? 0)} kcal`);
    setText("");
    router.refresh();
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 130)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && open) {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp" && open) {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, -1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (open && cursor >= 0 && results[cursor]) pick(results[cursor]);
                else submitText();
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            aria-label="What did you eat?"
            className={
              "w-full bg-surface-2 border border-border rounded-xl h-10 pl-3.5 pr-9 text-sm transition-colors " +
              "placeholder:text-faint hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            }
          />
          {busy ? (
            <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
          ) : (
            text.trim() && <CornerDownLeft className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
          )}
        </div>

        {onPhoto && (
          <Button variant="secondary" size="icon" onClick={onPhoto} aria-label="Log from a photo" title="Log from a photo">
            <Camera className="size-4" />
          </Button>
        )}
        {/* Only shown once there is something to add, so empty meals stay quiet. */}
        {text.trim() && (
          <Button variant="primary" onClick={submitText} loading={busy} className="animate-pop">
            Add
          </Button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 top-[calc(100%+6px)] bg-surface border border-border rounded-xl shadow-[var(--shadow-pop)] overflow-hidden max-h-72 overflow-y-auto animate-pop"
        >
          {results.map((result, i) => (
            <li key={result.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(result);
                }}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                  i === cursor ? "bg-surface-2" : "hover:bg-surface-2"
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] truncate">{result.name}</span>
                  <span className="block text-[11.5px] text-faint tnum">
                    {result.quantity % 1 === 0 ? result.quantity : result.quantity.toFixed(2).replace(/0+$/, "")} {result.unit} · {fmt(result.grams)} g · P {fmt(result.protein)}
                  </span>
                </span>
                {result.source !== "builtin" && <Sparkles className="size-3 text-faint shrink-0" />}
                <span className="text-[13px] tnum font-medium shrink-0">{fmt(result.kcal)}</span>
              </button>
            </li>
          ))}
          {aiOn && (
            <li className="px-3.5 py-2 border-t border-border text-[11.5px] text-faint">
              Not listed? Press Enter — anything unknown is estimated by AI and saved to your foods.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
