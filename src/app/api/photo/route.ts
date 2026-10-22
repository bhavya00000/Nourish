import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { configFor } from "@/lib/ai-config";
import { isDate } from "@/lib/tracker";
import { MEALS } from "@/lib/nutrition";
import { limited } from "@/lib/limited-stream";
import { compressPhoto, logPhoto, type PhotoResult } from "@/lib/photo";

/** A camera original can be 10-20 MB; it is compressed here before the AI sees it. */
const MAX_BYTES = 25 * 1024 * 1024;

const fail = (error: string, status = 400) =>
  NextResponse.json({ added: 0, kcal: 0, names: [], error } satisfies PhotoResult, { status });

/**
 * Photo logging. A route rather than a Server Action because those cap the
 * body at 1 MB, and a phone that cannot shrink the photo itself sends the original.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return fail("Not signed in.", 401);

  const ai = await configFor(user.id);
  if (!ai) return fail("Photo logging needs an AI key. Add one in Settings.");

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES || !request.body) {
    return fail("That photo is too large. Try one under 25 MB.", 413);
  }

  let form: FormData;
  try {
    form = await new Response(limited(request.body, MAX_BYTES), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("That photo is too large or did not arrive whole. Try again.", 413);
  }

  const photo = form.get("photo");
  const fields = z
    .object({ meal: z.enum(MEALS), date: z.string().refine(isDate), hint: z.string().trim().max(200).optional() })
    .safeParse({ meal: form.get("meal"), date: form.get("date"), hint: form.get("hint") || undefined });
  if (!(photo instanceof File) || !photo.size || !fields.success) return fail("That image could not be read.");

  try {
    const image = await compressPhoto(Buffer.from(await photo.arrayBuffer()));
    const result = await logPhoto(user.id, ai, { image, ...fields.data });

    revalidatePath("/today");
    revalidatePath("/reports");
    revalidatePath("/coach");
    return NextResponse.json(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Photo analysis failed.");
  }
}
