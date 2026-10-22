"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { login, register, type AuthState } from "@/actions/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? login : register;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-[13.5px] text-muted text-pretty">
          {mode === "login" ? "Sign in to pick up where you left off." : "Takes a minute. Your data stays on your own server."}
        </p>
      </div>

      <form action={formAction} className="space-y-3.5">
        {mode === "register" && (
          <Field label="Name">
            <Input name="name" autoComplete="name" placeholder="Your name" required />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </Field>
        <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
          <Input
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder="••••••••"
            required
            minLength={mode === "register" ? 8 : undefined}
          />
        </Field>

        {state?.error && (
          <p role="alert" className="text-[13px] text-danger">
            {state.error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="text-[13px] text-muted text-center">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="text-text underline underline-offset-4 hover:opacity-70">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-text underline underline-offset-4 hover:opacity-70">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
