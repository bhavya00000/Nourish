"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dumbbell, Search, UtensilsCrossed } from "lucide-react";
import { Spinner } from "@/components/ui/button";
import { Card, CardBody, Empty } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { searchHistoryAction, type SearchHit } from "@/actions/daily";
import { cn, fmt, prettyDate } from "@/lib/utils";

/** Feature: find anything you have logged — "when did I last have biryani?" */
export function SearchView() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "food" | "workout">("all");
  const [days, setDays] = useState("30");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [totals, setTotals] = useState<{ foodCount: number; foodKcal: number; workoutCount: number; days: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only focus on devices with a real keyboard; on a phone it would throw the
  // on-screen keyboard over the page before the user has asked for it.
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      const result = await searchHistoryAction({ query, kind, days: Number(days) });
      if (cancelled) return;
      setHits(result.hits);
      setTotals(result.totals);
      setBusy(false);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, kind, days]);

  // Group by day so the list reads like a diary.
  const groups = hits.reduce<{ date: string; items: SearchHit[] }[]>((acc, hit) => {
    const last = acc[acc.length - 1];
    if (last && last.date === hit.date) last.items.push(hit);
    else acc.push({ date: hit.date, items: [hit] });
    return acc;
  }, []);

  return (
    <div className="space-y-4 animate-in">
      <header>
        <h1 className="text-[17px] font-semibold tracking-tight">Search</h1>
        <p className="text-[13px] text-muted mt-0.5">Everything you have logged — food and training.</p>
      </header>

      <Card>
        <CardBody className="pt-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="biryani, bench press, paneer…"
              aria-label="Search your history"
              className="w-full bg-surface-2 border border-border rounded-xl h-11 pl-10 pr-10 text-sm placeholder:text-faint hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
            />
            {busy && <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint" />}
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <SegmentedControl
              value={kind}
              onChange={setKind}
              options={[{ value: "all", label: "All" }, { value: "food", label: "Food" }, { value: "workout", label: "Training" }]}
            />
            <SegmentedControl
              value={days}
              onChange={setDays}
              options={[{ value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "365", label: "1y" }, { value: "0", label: "All" }]}
            />
          </div>
          {totals && query && (
            <p className="text-[12.5px] text-muted text-pretty">
              {totals.foodCount > 0 && <>{totals.foodCount} food entr{totals.foodCount === 1 ? "y" : "ies"} ({fmt(totals.foodKcal)} kcal)</>}
              {totals.foodCount > 0 && totals.workoutCount > 0 && " and "}
              {totals.workoutCount > 0 && <>{totals.workoutCount} session{totals.workoutCount === 1 ? "" : "s"}</>}
              {(totals.foodCount > 0 || totals.workoutCount > 0) && ` across ${totals.days} day${totals.days === 1 ? "" : "s"}.`}
            </p>
          )}
        </CardBody>
      </Card>

      {!busy && hits.length === 0 ? (
        <Card><CardBody className="pt-5"><Empty>{query ? `Nothing matching “${query}”.` : "Nothing logged in this period yet."}</Empty></CardBody></Card>
      ) : (
        groups.map((group) => (
          <Card key={group.date}>
            <CardBody className="pt-4 space-y-2">
              <h2 className="text-[12px] uppercase tracking-[0.07em] text-faint font-medium">{prettyDate(group.date)}</h2>
              {group.items.map((hit, i) => (
                <Link
                  key={`${hit.kind}-${i}`}
                  href={hit.href}
                  className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 hover:bg-surface-2 transition-colors min-w-0"
                >
                  <span className={cn("grid place-items-center size-7 rounded-lg shrink-0", hit.kind === "food" ? "bg-kcal/12 text-kcal" : "bg-protein/12 text-protein")}>
                    {hit.kind === "food" ? <UtensilsCrossed className="size-3.5" /> : <Dumbbell className="size-3.5" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] truncate">{hit.title}</span>
                    <span className="block text-[11.5px] text-faint truncate">{hit.detail}</span>
                  </span>
                  <span className="text-[13px] tnum font-medium shrink-0">
                    {hit.kind === "workout" ? "−" : ""}{fmt(hit.kcal)}
                  </span>
                </Link>
              ))}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}
