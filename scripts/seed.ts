import { getPrisma } from "@/lib/prisma";
const prisma = getPrisma();

async function main() {
  let d1 = await prisma.driver.findFirst({ where: { phone: "9000000001" } });
  if (!d1) {
    d1 = await prisma.driver.create({
      data: { name: "Michael Rodriguez", phone: "9000000001", hidden: false },
    });
  }

  let d2 = await prisma.driver.findFirst({ where: { phone: "9000000002" } });
  if (!d2) {
    d2 = await prisma.driver.create({
      data: { name: "Sarah Johnson", phone: "9000000002", hidden: false },
    });
  }

  await prisma.weeklyEntry.createMany({
    data: [
      { driverId: d1.id, weekStart: new Date("2025-10-27"), weekEnd: new Date("2025-11-02"), earnings: 1850, trips: 64 },
      { driverId: d2.id, weekStart: new Date("2025-10-27"), weekEnd: new Date("2025-11-02"), earnings: 2100, trips: 66 },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });