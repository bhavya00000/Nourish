import { NextResponse } from "next/server";
import { userForToken } from "@/lib/health/tokens";
import { applyHealthBatch, recordFailedSync } from "@/lib/health/apply";
import { isHealthAutoExport, parseHealthAutoExport, parseSimpleJson } from "@/lib/health/formats";
import { sanitiseDay } from "@/lib/health/types";

const MAX_BYTES = 5 * 1024 * 1024;

const unauthorised = () =>
  NextResponse.json(
    { ok: false, error: "Missing or invalid token. Send it as 'Authorization: Bearer nsh_…'. Create one in Settings → Health data." },
    { status: 401 }
  );

/** A quick way for a phone automation to check its token works. */
export async function GET(request: Request) {
  const auth = await userForToken(request);
  if (!auth) return unauthorised();
  return NextResponse.json({ ok: true, account: auth.name, message: "Token works. POST health data to this same URL." });
}

/**
 * Phones push health data here: an iOS Shortcut, Health Auto Export, or any
 * Android automation. Authenticated by a personal token, not a browser session.
 */
export async function POST(request: Request) {
  const auth = await userForToken(request);
  if (!auth) return unauthorised();

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Too large for a push. For a full history, import the export file in Settings." }, { status: 413 });
  }

  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Too large for a push. For a full history, import the export file in Settings." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    await recordFailedSync(auth.userId, "Phone", "push", "Body was not valid JSON.");
    return NextResponse.json({ ok: false, error: "The body must be JSON, e.g. {\"date\":\"2026-09-15\",\"steps\":8500}" }, { status: 400 });
  }

  try {
    const batch = isHealthAutoExport(body) ? parseHealthAutoExport(body) : parseSimpleJson(body, request.headers.get("x-source") ?? "Apple Health");
    const result = await applyHealthBatch(auth.userId, batch, "push");
    // Echo what was read, so whoever builds the Shortcut can see each value landed.
    const saved = batch.days.map(sanitiseDay).filter((d) => d !== null).slice(0, 14);
    return NextResponse.json({
      ok: true,
      source: batch.source,
      ...result,
      saved,
      ...(!saved.length && {
        hint: "No values could be read. Send numbers, e.g. {\"steps\": 8500, \"sleep\": \"7 hr 12 min\"} — in Shortcuts, use the Calculate Statistics result, not the Health Samples list.",
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that data.";
    await recordFailedSync(auth.userId, "Phone", "push", message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
