"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { PhotoResult } from "@/lib/photo";
import { MEAL_META, fmt } from "@/lib/utils";

const MAX_EDGE = 1024; // plenty for recognition, and keeps the upload small
const SHRINK_TIMEOUT_MS = 8000;

/**
 * Shrink on the phone so the upload is small on mobile data. A huge camera
 * original can be too much for the phone to decode, so give up after a few
 * seconds and let the server compress the original instead.
 */
async function shrinkOnDevice(file: File): Promise<Blob | null> {
  const work = (async () => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SHRINK_TIMEOUT_MS));
  return Promise.race([work, timeout]).catch(() => null);
}

/** Feature: photograph a plate and have the AI log what is on it. */
export function PhotoLogger({ open, onClose, date, defaultMeal }: { open: boolean; onClose: () => void; date: string; defaultMeal: string }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [meal, setMeal] = useState(defaultMeal);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  async function handleFile(file: File) {
    if (file.type && !file.type.startsWith("image/")) return toast("Choose an image file.", "error");

    setPreparing(true);
    // Whatever arrives is compressed again on the server, so the original is a safe fallback.
    const chosen = (await shrinkOnDevice(file)) ?? file;
    setPhoto(chosen);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(chosen);
    });
    setPreparing(false);
  }

  async function submit() {
    if (!photo) return;
    setBusy(true);

    const body = new FormData();
    body.append("photo", photo, "meal.jpg");
    body.append("meal", meal);
    body.append("date", date);
    if (hint.trim()) body.append("hint", hint.trim());

    let result: PhotoResult;
    try {
      const res = await fetch("/api/photo", { method: "POST", body, signal: AbortSignal.timeout(180_000) });
      result = await res.json();
    } catch (err) {
      setBusy(false);
      return toast(
        err instanceof DOMException && err.name === "TimeoutError"
          ? "That took too long. Try again in a moment."
          : "Could not send the photo. Check your connection and try again.",
        "error"
      );
    }
    setBusy(false);

    if (result.error) return toast(result.error, "error");
    if (!result.added) return toast(result.note ?? "No food was recognised in that photo.", "error");

    toast(`Logged ${result.names.join(", ")} · ${fmt(result.kcal)} kcal. Check the portions and adjust if needed.`);
    reset();
    onClose();
    router.refresh();
  }

  function reset() {
    setPhoto(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setHint("");
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Log from a photo"
      description="The AI identifies what is on the plate and estimates the portion. Always worth a glance afterwards."
    >
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {preparing ? (
          <div className="w-full h-40 rounded-xl border border-border bg-surface-2 grid place-items-center text-[13px] text-muted">
            Preparing photo…
          </div>
        ) : preview ? (
          <div className="relative rounded-xl overflow-hidden border border-border bg-surface-2">
            <Image src={preview} alt="Your meal" width={640} height={480} unoptimized className="w-full h-52 object-cover" />
            <Button variant="secondary" size="sm" className="absolute bottom-2 right-2" onClick={() => fileRef.current?.click()}>
              Change
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-40 rounded-xl border border-dashed border-border-strong grid place-items-center gap-2 text-muted hover:bg-surface-2 transition-colors"
          >
            <Camera className="size-6" strokeWidth={1.5} />
            <span className="text-[13px]">Take a photo or choose one</span>
            <span className="text-[11.5px] text-faint flex items-center gap-1">
              <Upload className="size-3" /> Any size — it is compressed before the AI sees it
            </span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Meal">
            <Select value={meal} onChange={(e) => setMeal(e.target.value)}>
              {MEAL_META.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hint (optional)">
            <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="home cooked, small plate" />
          </Field>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!photo || preparing} loading={busy}>
            {busy ? "Reading the photo…" : "Identify and log"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
