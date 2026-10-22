import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Set up" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [profile, goal] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-5 sm:px-8 h-16">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid place-items-center size-7 rounded-lg bg-primary text-primary-text text-[13px]">N</span>
          Nourish
        </span>
        <ThemeToggle />
      </header>
      <main className="flex-1 mx-auto w-full max-w-lg px-5 sm:px-0 pb-16">
        <OnboardingFlow
          initial={{
            age: profile?.age ?? null,
            sex: profile?.sex ?? "male",
            heightCm: profile?.heightCm ?? null,
            weightKg: profile?.weightKg ?? null,
            jobRole: profile?.jobRole ?? "desk",
            gymType: profile?.gymType ?? "none",
            gymDays: profile?.gymDays ?? 0,
            walkMinutes: profile?.walkMinutes ?? 0,
            dietType: profile?.dietType ?? "veg",
            cuisines: profile?.cuisines ?? "indian",
            allergies: profile?.allergies ?? "",
            dislikes: profile?.dislikes ?? "",
            extraInfo: profile?.extraInfo ?? "",
            eatingWindowH: profile?.eatingWindowH ?? 12,
            goalType: (goal?.goalType as "lose") ?? "lose",
            targetWeight: goal?.targetWeight ?? null,
            targetWeeks: goal?.targetWeeks ?? 24,
          }}
        />
      </main>
    </div>
  );
}
