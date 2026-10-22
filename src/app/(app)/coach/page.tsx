import { requireUser } from "@/lib/auth";
import { aiAvailableFor } from "@/lib/ai-config";
import { daySummary, todayISO } from "@/lib/tracker";
import { CoachView } from "@/components/coach-view";

export const metadata = { title: "Coach" };

export default async function CoachPage() {
  const user = await requireUser();
  const [day, aiOn] = await Promise.all([daySummary(user.id, todayISO()), aiAvailableFor(user.id)]);
  return <CoachView day={day} aiOn={aiOn} />;
}
