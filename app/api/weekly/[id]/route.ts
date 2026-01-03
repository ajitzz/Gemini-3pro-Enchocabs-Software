// app/api/weekly/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

const prisma = getPrisma();
const weeklyEntryModel = (prisma as any).weeklyEntry ?? null;
const weeklyEarningModel = (prisma as any).weeklyEarning ?? null;
const Weekly: any = weeklyEntryModel ?? weeklyEarningModel;
const usesNewFields = Boolean(weeklyEntryModel);

// Shared helper with /api/weekly
function parseYMD(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const updateSchema = z.object({
  weekStart: z.string().optional(),
  weekEnd: z.string().optional(),
  earnings: z.coerce.number().optional(),
  trips: z.coerce.number().int().optional(),
  // New: allow updating notes from the Manage page
  notes: z.string().optional(),
});

function coerceId(raw: string) {
  const numeric = Number(raw);
  return Number.isInteger(numeric) ? numeric : null;
}

// ───────────────── GET /api/weekly/:id ─────────────────
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!Weekly) {
    return NextResponse.json(
      { error: "Weekly model not found" },
      { status: 500 },
    );
  }

  const id = coerceId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const row = await Weekly.findUnique({ where: { id } });
    return NextResponse.json(row ?? null, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? "Failed") },
      { status: 500 },
    );
  }
}

// ───────────────── PATCH /api/weekly/:id (partial update) ─────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!Weekly) {
    return NextResponse.json(
      { error: "Weekly model not found" },
      { status: 500 },
    );
  }

  const id = coerceId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const d = parsed.data;

    const data: any = {};

    // Dates (optional)
    if (d.weekStart) {
      const dt = parseYMD(d.weekStart);
      data[usesNewFields ? "weekStart" : "weekStartDate"] = dt;
    }
    if (d.weekEnd) {
      const dt = parseYMD(d.weekEnd);
      data[usesNewFields ? "weekEnd" : "weekEndDate"] = dt;
    }

    // Earnings & trips (optional)
    if (typeof d.earnings === "number" && Number.isFinite(d.earnings)) {
      data[usesNewFields ? "earnings" : "earningsInINR"] = d.earnings;
    }
    if (typeof d.trips === "number" && Number.isFinite(d.trips)) {
      data[usesNewFields ? "trips" : "tripsCompleted"] = d.trips;
    }

    // Notes (optional; allow empty string to clear)
    if (typeof d.notes === "string") {
      data.notes = d.notes;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const updated = await Weekly.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? "Failed") },
      { status: 400 },
    );
  }
}

// ───────────────── DELETE /api/weekly/:id ─────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!Weekly) {
    return NextResponse.json(
      { error: "Weekly model not found" },
      { status: 500 },
    );
  }

  const id = coerceId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await Weekly.delete({ where: { id } });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? "Failed") },
      { status: 400 },
    );
  }
}
