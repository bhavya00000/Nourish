import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { weightKg: true },
  });
  redirect(profile?.weightKg ? "/dashboard" : "/onboarding");
}
