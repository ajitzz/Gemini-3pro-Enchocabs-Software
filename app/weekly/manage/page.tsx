import { getPrisma } from "@/lib/prisma";
import DeleteWeeklyTableClient from "./_components/DeleteWeeklyTableClient";
const prisma = getPrisma();

export const dynamic = "force-dynamic";

// Compatibility: support both prisma.weeklyEntry (new) and prisma.weeklyEarning (old)
const Weekly: any = (prisma as any).weeklyEntry ?? (prisma as any).weeklyEarning;

export default async function ManageWeeklyPage() {
  const rows: any[] = await Weekly.findMany({
    where: { driver: { hidden: false, removedAt: null } },
    include: { driver: { select: { id: true, name: true, hidden: true } } },
    // orderBy fields differ; we sort by the coalesced server-side after fetch if needed
    orderBy: [{ createdAt: "desc" }],
  });

  // Normalize field names across old/new models
  const initialRows = rows
    .map((r: any) => {
      const weekStart: Date = r.weekStart ?? r.weekStartDate;
      const weekEnd: Date = r.weekEnd ?? r.weekEndDate;
      const earningsNum: number = Number(r.earnings ?? r.earningsInINR);
      const tripsNum: number = Number(r.trips ?? r.tripsCompleted);

      return {
        id: r.id,
        driverName: r.driver.name,
        driverId: r.driver.id,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        earnings: earningsNum,
        trips: tripsNum,
        notes: r.notes ?? "",
        hidden: r.driver.hidden,
        createdAt: r.createdAt as Date,
      };
    })
    // ensure newest weeks first
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl font-semibold mb-4">Manage Weekly Entries</h1>
      <DeleteWeeklyTableClient initialRows={initialRows} />
    </div>
  );
}