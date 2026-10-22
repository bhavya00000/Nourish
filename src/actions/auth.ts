"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type AuthState = { error?: string } | undefined;

const registerSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(60),
  email: z.string().trim().toLowerCase().email("That does not look like an email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "An account with that email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(password),
      // Create the related rows up front so later saves are simple updates.
      profile: { create: {} },
      goal: { create: {} },
    },
    select: { id: true },
  });

  await createSession(user.id);
  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, profile: { select: { weightKg: true } } },
  });

  // Always compare against something so a missing account and a wrong password
  // take the same time to answer.
  const valid = user
    ? verifyPassword(parsed.data.password, user.passwordHash)
    : verifyPassword(parsed.data.password, hashPassword("placeholder"));

  if (!user || !valid) return { error: "Wrong email or password." };

  await createSession(user.id);
  redirect(user.profile?.weightKg ? "/dashboard" : "/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
