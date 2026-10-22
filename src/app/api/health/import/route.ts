import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { applyHealthBatch, recordFailedSync } from "@/lib/health/apply";
import { readAppleHealthExport } from "@/lib/health/apple-export";
import { parseHealthCsv } from "@/lib/health/formats";
import { limited } from "@/lib/limited-stream";
import { shiftDate, todayISO } from "@/lib/utils";

const MAX_APPLE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_CSV_BYTES = 20 * 1024 * 1024;

/**
 * Upload an Apple Health export (.zip or export.xml) or a CSV. The Apple file
 * is streamed and aggregated as it arrives, so its size does not matter.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!request.body) return NextResponse.json({ ok: false, error: "No file received." }, { status: 400 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "csv" ? "csv" : "apple";
  const days = Math.min(3650, Math.max(1, Number(url.searchParams.get("days")) || 365));
  const since = shiftDate(todayISO(), -days);

  try {
    if (kind === "apple") {
      const { batch, records } = await readAppleHealthExport(limited(request.body, MAX_APPLE_BYTES), since);
      if (!records) {
        return NextResponse.json({ ok: false, error: `No health records from the last ${days} days were found in that file.` }, { status: 400 });
      }
      const result = await applyHealthBatch(user.id, batch, "import");
      return NextResponse.json({ ok: true, source: batch.source, records, ...result });
    }

    const text = await new Response(limited(request.body, MAX_CSV_BYTES)).text();
    const source = (url.searchParams.get("source") ?? "CSV").slice(0, 40);
    const batch = parseHealthCsv(text, source);
    const inRange = { ...batch, days: batch.days.filter((d) => d.date >= since) };
    if (!inRange.days.length) {
      return NextResponse.json({ ok: false, error: "No rows with a recognisable date and at least one health value were found." }, { status: 400 });
    }
    const result = await applyHealthBatch(user.id, inRange, "import");
    return NextResponse.json({ ok: true, source, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that file.";
    await recordFailedSync(user.id, kind === "apple" ? "Apple Health" : "CSV", "import", message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
