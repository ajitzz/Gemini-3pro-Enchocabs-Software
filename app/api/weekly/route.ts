// app/api/weekly/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

// ───────────────── helpers ─────────────────
const prisma = getPrisma();
const weeklyEntryModel = (prisma as any).weeklyEntry ?? null;
const weeklyEarningModel = (prisma as any).weeklyEarning ?? null;
const Weekly: any = weeklyEntryModel ?? weeklyEarningModel;
const usesNewFields = Boolean(weeklyEntryModel);

/**
 * Parse a YYYY-MM-DD string into a UTC Date (midnight)
 */
function parseYMD(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const createSchema = z.object({
  driverId: z.string().min(1, "driverId required"),
  weekStart: z
    .string()
    .refine((s) => parseYMD(s) !== null, "Invalid weekStart (YYYY-MM-DD)"),
  weekEnd: z
    .string()
    .refine((s) => parseYMD(s) !== null, "Invalid weekEnd (YYYY-MM-DD)"),
  earnings: z.coerce.number().min(0, "earnings must be >= 0"),
  trips: z.coerce.number().int().min(0, "trips must be >= 0"),
  // New: allow notes coming from WeeklyAddForm
  notes: z.string().optional(),
});

// ───────────────── GET /api/weekly ─────────────────
// Optional query param: ?driverId=...
export async function GET(req: Request) {
  if (!Weekly) {
    return NextResponse.json(
      { error: "Weekly model not found (weeklyEntry/weeklyEarning)" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get("driverId") ?? undefined;
  const weekStartParam = searchParams.get("weekStart");
  const rangeStartParam = searchParams.get("rangeStart");
  const rangeEndParam = searchParams.get("rangeEnd");

  let weekStartFilter: Date | null = null;
  if (weekStartParam) {
    weekStartFilter = parseYMD(weekStartParam);
    if (!weekStartFilter) {
      return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
    }
  }

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  if (rangeStartParam || rangeEndParam) {
    if (!rangeStartParam || !rangeEndParam) {
      return NextResponse.json(
        { error: "rangeStart and rangeEnd are both required" },
        { status: 400 },
      );
    }

    rangeStart = parseYMD(rangeStartParam);
    rangeEnd = parseYMD(rangeEndParam);

    if (!rangeStart || !rangeEnd) {
      return NextResponse.json({ error: "Invalid rangeStart/rangeEnd" }, { status: 400 });
    }
    if (rangeStart > rangeEnd) {
      return NextResponse.json({ error: "rangeStart must be before rangeEnd" }, { status: 400 });
    }
  }

  try {
    const where: Record<string, any> = {};
    if (driverId) {
      where.driverId = driverId;
    }
    const startField = usesNewFields ? "weekStart" : "weekStartDate";
    const endField = usesNewFields ? "weekEnd" : "weekEndDate";

    if (weekStartFilter) {
      where[startField] = weekStartFilter;
    }
    if (rangeStart && rangeEnd) {
      where.AND = [
        ...(where.AND ?? []),
        { [startField]: { lte: rangeEnd } },
        { [endField]: { gte: rangeStart } },
      ];
    }

    const rows = await Weekly.findMany({
        where: Object.keys(where).length ? where : undefined,
      include: { driver: { select: { id: true, name: true } } },
      // Prefer weekEnd (new schema), fall back to weekStart (old)
      orderBy: [usesNewFields ? { weekEnd: "desc" } : { weekStart: "desc" }],
    } as any);

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? "Failed") },
      { status: 500 },
    );
  }
}

// ───────────────── POST /api/weekly ─────────────────
export async function POST(req: Request) {
  if (!Weekly) {
    return NextResponse.json(
      { error: "Weekly model not found (weeklyEntry/weeklyEarning)" },
      { status: 500 },
    );
  }

  try {
    const raw = await req.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const d = parsed.data;

    const weekStart = parseYMD(d.weekStart);
    const weekEnd = parseYMD(d.weekEnd);

    // Try new schema first; fall back to legacy field names (if present)
    const created = await Weekly.create({
      data: usesNewFields
        ? {
            driverId: d.driverId,
            weekStart,
            weekEnd,
            earnings: d.earnings,
            trips: d.trips,
            notes: d.notes,
          }
        : {
            driverId: d.driverId,
            weekStartDate: weekStart,
            weekEndDate: weekEnd,
            earningsInINR: d.earnings,
            tripsCompleted: d.trips,
            notes: d.notes,
          },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? "Failed") },
      { status: 400 },
    );
  }
}
