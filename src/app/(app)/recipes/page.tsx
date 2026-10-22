import { requireUser } from "@/lib/auth";
import { listRecipes } from "@/actions/recipes";
import { RecipesView } from "@/components/recipes-view";

export const metadata = { title: "Recipes" };

export default async function RecipesPage() {
  await requireUser();
  const recipes = await listRecipes();
  return <RecipesView recipes={recipes} />;
}
