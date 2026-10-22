import "server-only";
import crypto from "node:crypto";

// API keys belong to the user, so they are encrypted at rest with a key derived
// from AUTH_SECRET and never sent back to the browser.
const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const secret = process.env.AUTH_SECRET || "insecure-development-secret-do-not-ship";
  return crypto.scryptSync(secret, "nourish-api-key-encryption", 32);
}

export function encryptSecret(plain: string) {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(stored: string) {
  if (!stored) return "";
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) return "";
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong AUTH_SECRET, or corrupted data — treat it as "no key configured".
    return "";
  }
}

/** Safe to show in the UI: sk-abc…7f9 */
export function maskSecret(plain: string) {
  if (!plain) return "";
  if (plain.length <= 10) return `${plain.slice(0, 2)}…`;
  return `${plain.slice(0, 6)}…${plain.slice(-4)}`;
}
