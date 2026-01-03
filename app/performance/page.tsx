export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { unstable_noStore as noStore } from "next/cache";

import { getPrisma } from "@/lib/prisma";


import PerformanceClient, {
  type DriverDTO,
  type WeeklyEntryDTO,
} from "./performanceClient";

function toISODateOnly(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return utc.toISOString().slice(0, 10);
}

function toNumber(n: unknown): number {
  if (n == null) return 0;
  if (typeof n === "number") return Number.isFinite(n) ? n : 0;
  const asNum = Number((n as any).toString?.() ?? String(n));
  return Number.isFinite(asNum) ? asNum : 0;
}

function mapWeeklyEntry(entry: any): WeeklyEntryDTO {
  return {
    id: entry.id,
    weekStart: toISODateOnly(entry.weekStart ?? entry.weekStartDate),
    weekEnd: toISODateOnly(entry.weekEnd ?? entry.weekEndDate),
    earnings: toNumber(entry.earnings ?? entry.earningsInINR),
    trips: toNumber(entry.trips ?? entry.tripsCompleted),
    notes: entry.notes ?? null,
  };
}

function mapDriver(driver: any, weeklyEntries: any[] | null | undefined): DriverDTO {
  return {
    id: driver.id,
    name: driver.name,
    licenseNumber: driver.licenseNumber ?? "",
    phone: driver.phone ?? "",
    joinDate: toISODateOnly(driver.joinDate ?? null),
    profileImageUrl: driver.profileImageUrl ?? "",
    createdAt: driver.createdAt
      ? new Date(driver.createdAt).toISOString()
      : new Date().toISOString(),
    weeklyEntries: (weeklyEntries ?? []).map(mapWeeklyEntry),
  };
}

export default async function Page() {
  noStore();
  const prisma = getPrisma();
    try {
    const drivers = await prisma.driver.findMany({
      where: { hidden: false as any, removedAt: null as any },
 include: {
        weeklyEntries: {
          orderBy: [{ weekStart: "desc" as const }, { id: "desc" as const }],
        },
      },
      orderBy: { createdAt: "desc" as const },
    });
        const data = drivers.map((driver: any) =>
      mapDriver(driver, driver.weeklyEntries ?? [])
    );

    return <PerformanceClient drivers={data} />;
  } catch (error) {
    console.warn("[performance] relation include failed; falling back", error);
  }
  const driversOnly = await prisma.driver.findMany({
    where: { hidden: false as any, removedAt: null as any },
    orderBy: { name: "asc" as const },
  });

  const Weekly: any = (prisma as any).weeklyEntry ?? (prisma as any).weeklyEarning ?? null;
  const weeklyRows: any[] = Weekly
    ? await Weekly.findMany({
        where: { driverId: { in: driversOnly.map((d: any) => d.id) } },
        include: { driver: { select: { id: true } } },
        orderBy: [{ weekEnd: "desc" as const }],
      }).catch(async () => {
        return await Weekly.findMany({
          where: { driverId: { in: driversOnly.map((d: any) => d.id) } },
          include: { driver: { select: { id: true } } },
          orderBy: [{ weekStart: "desc" as const }],
        });
      })
    : [];

  const byDriver = new Map<string, any[]>();
   for (const row of weeklyRows) {
    const driverId = row.driverId ?? row.driver?.id;
    if (!driverId) continue;
    if (!byDriver.has(driverId)) byDriver.set(driverId, []);
    byDriver.get(driverId)!.push(row);
  }
  const data = driversOnly.map((driver: any) =>
    mapDriver(driver, byDriver.get(driver.id) ?? [])
  );

  return <PerformanceClient drivers={data} />;
}