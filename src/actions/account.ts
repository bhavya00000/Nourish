"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, destroySession, verifyPassword } from "@/lib/auth";

/** Feature: delete everything, for real. Cascades remove every related row. */
export async function deleteAccountAction(password: string) {
  const user = await requireUser();
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record || !verifyPassword(password, record.passwordHash)) {
    return { error: "That password is not right." };
  }

  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/login");
}

export async function clearDayAction(date: string) {
  const user = await requireUser();
  const { count } = await prisma.entry.deleteMany({ where: { userId: user.id, date } });
  return { ok: true, removed: count };
}

export async function myFoods() {
  const user = await requireUser();
  return prisma.food.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, kcal: true, protein: true, units: true, source: true, createdAt: true },
  });
}

export async function deleteFoodAction(id: string) {
  const user = await requireUser();
  await prisma.food.deleteMany({ where: { id, userId: user.id } });
  return { ok: true };
}
