import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser()) redirect("/dashboard");

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid place-items-center size-7 rounded-lg bg-primary text-primary-text text-[13px]">N</span>
            Nourish
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-sm animate-in">{children}</div>
        </main>
      </div>

      {/* A quiet marketing panel, hidden on phones where it would just be noise. */}
      <aside className="hidden lg:flex flex-col justify-center gap-8 bg-surface-2 border-l border-border px-14">
        <p className="text-[28px] leading-[1.25] font-semibold tracking-tight text-balance max-w-md">
          Type <span className="text-muted">&ldquo;2 roti and 1 katori dal&rdquo;</span>. That is the whole workflow.
        </p>
        <ul className="space-y-3.5 text-[14px] text-muted max-w-md">
          {[
            "No calorie lookups. Portions, macros and totals are worked out for you.",
            "Anything it does not recognise is estimated by AI and saved to your list.",
            "Targets adapt to what your weight actually does, not just a formula.",
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-2 size-1.5 rounded-full bg-kcal shrink-0" />
              <span className="text-pretty">{line}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
