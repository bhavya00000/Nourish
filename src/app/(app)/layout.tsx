import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { RegisterServiceWorker } from "@/components/register-sw";
import { ProductTour } from "@/components/product-tour";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { weightKg: true, tourSeenAt: true },
  });
  if (!profile?.weightKg) redirect("/onboarding");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[236px_1fr]">
      <AppNav userName={user.name} />
      <div className="min-w-0">
        <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 pt-4 pb-28 lg:pb-12 lg:pt-8">{children}</main>
      </div>
      <RegisterServiceWorker />
      <ProductTour name={user.name} autoStart={!profile.tourSeenAt} />
    </div>
  );
}
