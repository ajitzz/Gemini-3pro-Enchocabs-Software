export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { unstable_noStore as noStore } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import DriversClient, { type DriverListItem } from "./_components/DriverClient";

/** Convert a JS Date to YYYY-MM-DD (UTC) or null */
function toISODateOnly(d?: Date | null) {
  if (!d) return null;
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return utc.toISOString().slice(0, 10);
}

export default async function DriversPage() {
  noStore(); // ensure fresh data on every request

  const prisma = getPrisma();
  const rows = await prisma.driver.findMany({
    where: {
      // Keep removed rows out of the list if your schema has this column
      // @ts-ignore - optional column in some schemas
      removedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  const initialDrivers: DriverListItem[] = rows.map((d:any) => ({
    id: d.id,
    name: d.name ?? "",
    licenseNumber: (d as any).licenseNumber ?? "",
    phone: (d as any).phone ?? "",
    joinDate: toISODateOnly((d as any).joinDate ?? null),
    profileImageUrl: (d as any).profileImageUrl ?? "",
    hidden: Boolean((d as any).hidden),
    createdAt: (d.createdAt ?? new Date()).toISOString(),
  }));

  return <DriversClient initialDrivers={initialDrivers} />;
}