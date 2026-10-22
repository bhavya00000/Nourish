import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Feature: take your data with you — full JSON, or a spreadsheet of entries. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  const entries = await prisma.entry.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "asc" }, { eatenAt: "asc" }],
  });

  if (format === "csv") {
    // A food named "=HYPERLINK(…)" must stay text when the file is opened in a spreadsheet.
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return `"${(typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
    };
    const header = "date,meal,food,quantity,unit,grams,kcal,protein_g,carbs_g,fat_g,source,logged_as";
    const rows = entries.map((e) =>
      [e.date, e.meal, e.foodName, e.quantity, e.unit, e.grams, e.kcal, e.protein, e.carbs, e.fat, e.source, e.rawText]
        .map(escape)
        .join(",")
    );
    return new NextResponse([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nourish-${stamp}.csv"`,
      },
    });
  }

  const [profile, goal, weights, days, recipes, foods, measurements, workouts, routines, exercises] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
    prisma.weightLog.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.dayLog.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.recipe.findMany({ where: { userId: user.id }, include: { items: true } }),
    prisma.food.findMany({ where: { userId: user.id } }),
    prisma.measurement.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      include: { sets: { include: { exercise: { select: { name: true } } }, orderBy: [{ position: "asc" }, { setNumber: "asc" }] } },
    }),
    prisma.routine.findMany({ where: { userId: user.id }, include: { items: { include: { exercise: { select: { name: true } } } } } }),
    prisma.exercise.findMany({ where: { userId: user.id } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    account: { name: user.name, email: user.email },
    profile,
    goal,
    entries,
    weights,
    days,
    recipes,
    foods,
    measurements,
    workouts,
    routines,
    exercises,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nourish-${stamp}.json"`,
    },
  });
}
