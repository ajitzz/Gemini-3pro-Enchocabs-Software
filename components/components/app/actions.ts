
// app/actions.ts
"use server";

import { getPrisma } from "@/lib/prisma";
import { z } from "zod";
// app/actions.ts

const prisma = getPrisma();

// …your server actions (unchanged below)

/* ----------------------------- Date helpers ----------------------------- */
// NOTE: helpers are NOT exported to satisfy "use server" rule.
function toDate(d: string | Date) {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const [y, m, day] = d.split("-").map(Number); // expects yyyy-mm-dd
  return new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1));
}
function startOfWeekMon(date: Date) {
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
}
function endOfWeekSun(date: Date) {
  const s = startOfWeekMon(date);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 6));
}
function getWeekBounds(weekStart: string | Date) {
  const d = toDate(weekStart);
  const start = startOfWeekMon(d);
  const end = endOfWeekSun(start);
  return { start, end };
}

/* ------------------------------ Validation ----------------------------- */
// Keep schema INTERNAL (do NOT export) so this file only exports async fns.
const weeklyEntrySchema = z.object({
  driverId: z.string().min(1),
  weekStart: z.union([z.string(), z.date()]), // Monday of the week (yyyy-mm-dd)
  earnings: z.coerce.number().nonnegative(), // INR
  trips: z.coerce.number().int().nonnegative(),
  notes: z.string().trim().optional().nullable(),
});
type WeeklyEntryInput = z.infer<typeof weeklyEntrySchema>;

/* -------------------------------- Actions ------------------------------- */
/** Create or update a weekly entry (idempotent upsert). */
export async function createWeeklyEntry(input: unknown) {
  const parsed = weeklyEntrySchema.parse(input);

  const driver = await prisma.driver.findFirst({
    where: { id: parsed.driverId, hidden: false, removedAt: null },
  });
  if (!driver) throw new Error("Driver is hidden, removed, or does not exist.");

  const { start, end } = getWeekBounds(parsed.weekStart);

  return prisma.weeklyEntry.upsert({
    where: {
      driverId_weekStart: {
        driverId: parsed.driverId,
        weekStart: start,
      },
    },
    update: {
      weekEnd: end,
      earnings: parsed.earnings,
      trips: parsed.trips,
      notes: parsed.notes ?? null,
    },
    create: {
      driverId: parsed.driverId,
      weekStart: start,
      weekEnd: end,
      earnings: parsed.earnings,
      trips: parsed.trips,
      notes: parsed.notes ?? null,
    },
  });
}

export async function updateWeeklyEntry(id: number | string, input: Partial<WeeklyEntryInput>) {
  const parsed = weeklyEntrySchema.partial().parse(input);
  const patch: any = {};

  if (parsed.weekStart) {
    const { start, end } = getWeekBounds(parsed.weekStart);
    patch.weekStart = start;
    patch.weekEnd = end;
  }
  if (typeof parsed.earnings === "number") patch.earnings = parsed.earnings;
  if (typeof parsed.trips === "number") patch.trips = parsed.trips;
  if (parsed.notes !== undefined) patch.notes = parsed.notes ?? null;

  return prisma.weeklyEntry.update({
    where: { id: id as any },
    data: patch,
  });
}

export async function deleteWeeklyEntry(id: number | string) {
  const res = await prisma.weeklyEntry.delete({ where: { id: id as any } });
  return { count: 1, id: res.id };
}

export async function deleteWeeklyEntries(ids: Array<number | string>) {
  if (!ids?.length) return { count: 0 };
  const res = await prisma.weeklyEntry.deleteMany({ where: { id: { in: ids as any[] } } });
  return { count: res.count };
}

export async function listWeeklyEntries(params: {
  driverId?: string;
  weekStart?: string;
  weekEnd?: string;
}) {
  const where: any = {};
  if (params.driverId) where.driverId = params.driverId;
  if (params.weekStart) where.weekStart = toDate(params.weekStart);
  if (params.weekEnd) where.weekEnd = toDate(params.weekEnd);

  return prisma.weeklyEntry.findMany({
    where,
    orderBy: [{ weekStart: "desc" }, { id: "desc" }],
  });
}