import { requireUser } from "@/lib/auth";
import { reportSummary } from "@/lib/reports";
import { ReportsView } from "@/components/reports-view";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const data = await reportSummary(user.id, days);

  return <ReportsView data={data} days={days} />;
}
