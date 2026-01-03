import { getPrisma } from "@/lib/prisma";
import WeeklyAddForm from "./WeeklyAddForm";
const prisma = getPrisma();

export const dynamic = "force-dynamic";

export default async function Page() {
  const drivers = await prisma.driver.findMany({
    where: { hidden: false, removedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl font-semibold mb-4">Add Weekly Entry</h1>
      <WeeklyAddForm drivers={drivers} />
    </div>
  );
}