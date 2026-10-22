import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { targetsFor } from "@/lib/tracker";
import { myFoods } from "@/actions/account";
import { aiSettingsFor } from "@/lib/ai-config";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, goal, targets, foods, aiSettings, lastSync] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
    targetsFor(user.id),
    myFoods(),
    aiSettingsFor(user.id),
    prisma.dayLog.findFirst({
      where: { userId: user.id, NOT: { healthSource: "" } },
      orderBy: { syncedAt: "desc" },
      select: { healthSource: true, syncedAt: true },
    }),
  ]);

  return (
    <SettingsView
      user={user}
      profile={JSON.parse(JSON.stringify(profile))}
      goal={JSON.parse(JSON.stringify(goal))}
      targets={targets}
      foods={JSON.parse(JSON.stringify(foods))}
      aiSettings={aiSettings}
      health={lastSync?.syncedAt ? { source: lastSync.healthSource, syncedAt: lastSync.syncedAt.toISOString() } : null}
    />
  );
}
