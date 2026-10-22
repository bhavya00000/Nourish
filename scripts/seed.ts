// Loads the built-in food database into SQLite. Safe to re-run: built-in foods
// are matched by name and updated, never duplicated, and user foods are untouched.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { SEED_FOODS } from "../src/lib/foods-seed.ts";
import { SEED_EXERCISES } from "../src/lib/exercises-seed.ts";
import { serialiseUnits } from "../src/lib/parser.ts";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

async function main() {
  let created = 0;
  let updated = 0;

  for (const food of SEED_FOODS) {
    const data = {
      name: food.name,
      aliases: food.aliases.join("|"),
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      units: serialiseUnits(food.units),
      veg: food.veg,
      cuisine: food.cuisine,
      tags: food.tags.join("|"),
      source: "builtin",
      verified: true,
    };

    const existing = await prisma.food.findFirst({
      where: { userId: null, name: food.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.food.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.food.create({ data: { ...data, userId: null } });
      created++;
    }
  }

  const total = await prisma.food.count({ where: { userId: null } });
  console.log(`Foods:     ${created} created, ${updated} updated, ${total} built-in in total.`);

  let exCreated = 0;
  let exUpdated = 0;

  for (const exercise of SEED_EXERCISES) {
    const data = {
      name: exercise.name,
      aliases: exercise.aliases.join("|"),
      category: exercise.category,
      muscles: exercise.muscles.join("|"),
      equipment: exercise.equipment,
      isCardio: exercise.isCardio,
      met: exercise.met,
      source: "builtin",
    };

    const existing = await prisma.exercise.findFirst({
      where: { userId: null, name: exercise.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.exercise.update({ where: { id: existing.id }, data });
      exUpdated++;
    } else {
      await prisma.exercise.create({ data: { ...data, userId: null } });
      exCreated++;
    }
  }

  const exTotal = await prisma.exercise.count({ where: { userId: null } });
  console.log(`Exercises: ${exCreated} created, ${exUpdated} updated, ${exTotal} built-in in total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
