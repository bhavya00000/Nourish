import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** The plain token is returned exactly once; only its hash is ever stored. */
export async function createHealthToken(userId: string, label: string) {
  const token = `nsh_${crypto.randomBytes(24).toString("base64url")}`;
  const row = await prisma.healthToken.create({
    data: { userId, label: label.trim().slice(0, 40) || "Phone", prefix: token.slice(0, 10), tokenHash: hash(token) },
    select: { id: true, label: true, prefix: true, createdAt: true },
  });
  return { ...row, token };
}

/** Accepts "Authorization: Bearer nsh_…" or "X-API-Key: nsh_…". */
export async function userForToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = (header.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.headers.get("x-api-key") ?? "").trim();
  if (!token.startsWith("nsh_")) return null;

  const row = await prisma.healthToken.findUnique({
    where: { tokenHash: hash(token) },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });
  if (!row) return null;

  await prisma.healthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return { userId: row.userId, name: row.user.name, tokenId: row.id };
}
