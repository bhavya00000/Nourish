"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setAdaptiveTdee } from "@/actions/profile";
import { fmt } from "@/lib/utils";
import type { AdaptiveResult } from "@/lib/adaptive";
import type { Targets } from "@/lib/nutrition";

/**
 * Feature: adaptive TDEE. Compares the formula estimate against what the user's
 * weight actually did, and takes over the target once there is enough data.
 */
export function AdaptivePanel({ adaptive, targets }: { adaptive: AdaptiveResult; targets: Targets | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(Boolean(targets?.learnedTdee) || adaptive.learnedTdee !== null);

  const learned = adaptive.learnedTdee;
  const difference = learned ? learned - adaptive.formulaTdee : 0;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Activity className="size-3.5 text-faint" />
            Adaptive maintenance
          </span>
        }
        subtitle="Your real maintenance, worked out from weight change against what you actually ate"
        action={
          <Switch
            checked={enabled}
            label="Use adaptive maintenance"
            disabled={pending}
            onChange={(next) => {
              setEnabled(next);
              startTransition(async () => {
                await setAdaptiveTdee(next);
                router.refresh();
              });
            }}
          />
        }
      />
      <CardBody>
        {learned ? (
          <div className="space-y-2.5">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[24px] font-semibold tnum">{fmt(learned)}</span>
              <span className="text-[13px] text-muted">
                kcal/day measured — the formula guessed {fmt(adaptive.formulaTdee)}
              </span>
            </div>
            <p className="text-[12.5px] text-muted text-pretty">
              {Math.abs(difference) < 60
                ? "The formula is close to reality for you, so your target is unchanged."
                : difference > 0
                  ? `You burn about ${fmt(difference)} kcal/day more than the formula predicts, so your target has been raised to match.`
                  : `You burn about ${fmt(Math.abs(difference))} kcal/day less than the formula predicts, so your target has been lowered to match.`}{" "}
              Based on {adaptive.weighIns} weigh-ins and {adaptive.loggedDays} logged days
              {adaptive.trendKgPerWeek !== null && (
                <> at {adaptive.trendKgPerWeek > 0 ? "+" : ""}{fmt(adaptive.trendKgPerWeek, 2)} kg/week</>
              )}
              .
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[13px] text-muted text-pretty">
              {adaptive.reason ?? "Not enough data yet."}
            </p>
            <div className="flex gap-4 text-[12px] text-faint tnum">
              <span>{adaptive.weighIns} / 4 weigh-ins</span>
              <span>{adaptive.loggedDays} / 10 logged days</span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
