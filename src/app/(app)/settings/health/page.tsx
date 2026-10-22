import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HealthView } from "@/components/health-view";

export const metadata = { title: "Health data" };

export default async function HealthPage() {
  const user = await requireUser();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.|192\.168\.|10\.|172\.)/.test(host) ? "http" : "https");

  const [tokens, syncs, syncedDays, latest, syncedWorkouts] = await Promise.all([
    prisma.healthToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, prefix: true, lastUsedAt: true, createdAt: true },
    }),
    prisma.healthSync.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.dayLog.count({ where: { userId: user.id, NOT: { healthSource: "" } } }),
    prisma.dayLog.findFirst({
      where: { userId: user.id, NOT: { healthSource: "" } },
      orderBy: { date: "desc" },
      select: { date: true, healthSource: true, syncedAt: true, steps: true, sleepHours: true, activeKcal: true },
    }),
    prisma.workout.count({ where: { userId: user.id, NOT: { source: "manual" } } }),
  ]);

  return (
    <HealthView
      endpoint={`${proto}://${host}/api/health/ingest`}
      host={host}
      tokens={JSON.parse(JSON.stringify(tokens))}
      syncs={JSON.parse(JSON.stringify(syncs))}
      syncedDays={syncedDays}
      syncedWorkouts={syncedWorkouts}
      latest={latest ? JSON.parse(JSON.stringify(latest)) : null}
    />
  );
}
