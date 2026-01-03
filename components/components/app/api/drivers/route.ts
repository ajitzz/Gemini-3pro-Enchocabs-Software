// app/api/drivers/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

function onlyDigits(s: string) { return (s ?? "").replace(/\D/g, ""); }
function parseYMD(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y,m,d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m??1)-1, d??1, 0,0,0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const bodySchema = z.object({
  name: z.string().trim().min(2, "Enter full name"),
  licenseNumber: z.string().optional().transform(v => typeof v==="string" ? v.trim().toUpperCase() : "").or(z.literal("").transform(()=> ""))
    .refine(s => s.length===0 || s.length>=3, { message: "Licence number must be at least 3 characters (or leave it blank)" }),
  phone: z.string().trim().min(1,"Phone is required").transform(onlyDigits).refine(d => d.length>=10, { message: "Enter a valid phone (10+ digits)" }),
  joinDate: z.string().trim().refine(s => parseYMD(s)!==null, { message: "Select a valid date" }),
  profileImageUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("").transform(()=> "")),
}).transform((data)=>({
  ...data,
  licenseNumber: data.licenseNumber || null,
  profileImageUrl: data.profileImageUrl || null,
  joinDate: parseYMD(data.joinDate)!,
}));

export async function GET() {
  const prisma = getPrisma();
  try {
    try {
      const drivers = await prisma.driver.findMany({ orderBy: { createdAt: "desc" as const } });
      return NextResponse.json(drivers, { headers: { "Cache-Control": "no-store" } });
    } catch {
      const drivers = await prisma.driver.findMany({ orderBy: { name: "asc" as const } });
      return NextResponse.json(drivers, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (e:any) {
    return NextResponse.json({ error: String(e?.message ?? "Failed to fetch drivers") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    const raw = await req.json();
    if (raw && raw.licenceNumber != null && raw.licenseNumber == null) raw.licenseNumber = raw.licenceNumber;

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }

    const data = parsed.data;
    const created = await prisma.driver.create({
      data: {
        name: data.name.trim(),
        licenseNumber: data.licenseNumber,
        phone: data.phone,
        joinDate: data.joinDate,
        profileImageUrl: data.profileImageUrl,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e:any) {
    const msg = String(e?.message ?? "Failed to create driver");
    if (/Unknown\s+argument\s+.+\s+in\s+data/i.test(msg) || /Argument .+ missing/i.test(msg)) {
      return NextResponse.json({
        error: "Your Prisma model `Driver` is missing one or more fields used by this API. Ensure the model has: name (String), licenseNumber (String?), phone (String), joinDate (DateTime), profileImageUrl (String?). Then run `npx prisma migrate dev`.",
        details: msg, needsMigration: true
      }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
