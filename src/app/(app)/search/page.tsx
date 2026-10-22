import { requireUser } from "@/lib/auth";
import { SearchView } from "@/components/search-view";

export const metadata = { title: "Search" };

export default async function SearchPage() {
  await requireUser();
  return <SearchView />;
}
