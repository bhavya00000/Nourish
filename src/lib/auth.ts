import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const COOKIE = "ct_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set. Generate one with: openssl rand -base64 48");
    }
    return new TextEncoder().encode("insecure-development-secret-do-not-ship");
  }
  return new TextEncoder().encode(value);
}

// scrypt is in the standard library, so there is no native module to build.
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export type SessionUser = { id: string; email: string; name: string };

/** Returns the signed-in user, or null. Never throws. */
export async function getUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = payload.uid as string;
    if (!uid) return null;
    return await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true },
    });
  } catch {
    return null;
  }
}

/** For route handlers: the user, or a thrown 401 response. */
export async function requireUser() {
  const user = await getUser();
  if (!user) throw new AuthError();
  return user;
}

export class AuthError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthError";
  }
}
