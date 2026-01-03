// app/performance/_components/PerformanceClient.tsx
"use client";


import React from "react";

import { cn } from "@/lib/utils";

// ---------------- Types shared with page.tsx ----------------
export type WeeklyEntryDTO = {
  id: number | string;
  weekStart: string; // yyyy-mm-dd
  weekEnd: string; // yyyy-mm-dd
  earnings: number;
  trips: number;
  notes?: string | null;
};


export type DriverDTO = {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  joinDate: string; // yyyy-mm-dd
  profileImageUrl?: string | null;
  createdAt: string;
  weeklyEntries: WeeklyEntryDTO[];
};
type WeekInfo = {
  label: "This Week" | "Recent Week";
  start: string;
  end: string;
  entries: { driver: DriverDTO; entry: WeeklyEntryDTO }[];
};


// ---------------- Date helpers (Mon–Sun) ----------------
const toUTC = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

const iso = (d: Date) => toUTC(d).toISOString().slice(0, 10);

const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

// start Monday
const startOfWeekMon = (d: Date) => {

  const day = d.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day;
  
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff)
  );
};
// end Sunday
const endOfWeekSun = (d: Date) => {
  const s = startOfWeekMon(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 6));
};


const formatRange = (startISO: string, endISO: string) => {
  if (!startISO || !endISO) return "—";
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  
  const md: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const yr: Intl.DateTimeFormatOptions = { year: "numeric" };
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  
  const startLabel = s.toLocaleDateString("en-GB", md);
  const endLabel = e.toLocaleDateString("en-GB", md);
  const yearSuffix = sameYear ? "" : ", " + e.toLocaleDateString("en-GB", yr);
  return `${startLabel} – ${endLabel}${yearSuffix}`;
};


const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// “This Week” if present; otherwise “Recent Week”
function pickDisplayWeek(
  
  rows: WeeklyEntryDTO[],
  curStartISO: string,
  curEndISO: string

): {
  label: "This Week" | "Recent Week";
  row: WeeklyEntryDTO | null;
  start: string;
  end: string;
} {
  const exact = rows.find((r) => r.weekStart === curStartISO && r.weekEnd === curEndISO);
  if (exact) return { label: "This Week", row: exact, start: curStartISO, end: curEndISO };
  const latest = [...rows].sort((a, b) => (a.weekEnd < b.weekEnd ? 1 : -1))[0] ?? null;
  if (latest)
    return {
      label: "Recent Week",
      row: latest,
    
      start: latest.weekStart,
      end: latest.weekEnd,
    };
  return { label: "This Week", row: null, start: curStartISO, end: curEndISO };
}


// ---------------- UI primitives (shadcn-like) ----------------
const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={cn(
      "rounded-2xl border border-black/5 bg-white shadow-sm",
      "transition-all duration-300",
      className
    )}
  />
);

const Badge = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
      className
    )}
  />
);


const Avatar = ({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  className?: string;
}) => (
  <div
    className={cn(
      "h-12 w-12 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5",
      className
    )}
  >
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    ) : (
      <div className="grid h-full w-full place-items-center text-sm text-gray-600">
        {fallback}
      </div>
    )}
  </div>
);

// ---------------- Modal ----------------
// ---------------- Modal ----------------
function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
   React.useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full items-end justify-center px-4 py-6 sm:items-center sm:px-6">
        <div
          className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}


// ---------------- Main Client ----------------
export default function PerformanceClient({ drivers }: { drivers: DriverDTO[] }) {
  const now = new Date();

  const curStart = iso(startOfWeekMon(now));
  const curEnd = iso(endOfWeekSun(now));

  const weekInfo = React.useMemo<WeekInfo>(() => {
    const pairs = drivers.flatMap((driver) =>
      driver.weeklyEntries.map((entry) => ({ driver, entry }))
    );

    const byRange = (start: string, end: string) =>
      pairs.filter((p) => p.entry.weekStart === start && p.entry.weekEnd === end);

    const currentEntries = byRange(curStart, curEnd);
    if (currentEntries.length > 0)
      return {
        label: "This Week" as const,
        start: curStart,
        end: curEnd,
        entries: currentEntries,
      };

    const latest = [...pairs]
      .filter((p) => p.entry.weekStart && p.entry.weekEnd)
      .sort((a, b) => (a.entry.weekEnd < b.entry.weekEnd ? 1 : -1))[0];

    if (latest)
      return {
        label: "Recent Week" as const,
        start: latest.entry.weekStart,
        end: latest.entry.weekEnd,
        entries: byRange(latest.entry.weekStart, latest.entry.weekEnd),
      };

    return {
      label: "This Week" as const,
      start: curStart,
      end: curEnd,
      entries: [],
    };
  }, [drivers, curStart, curEnd]);


 
  const kpi = React.useMemo(() => {
      const activeIds = new Set<string>();
    let total = 0;
 
    let top = 0;
    let topName = "—";

   for (const { driver, entry } of weekInfo.entries) {
      const amt = entry.earnings ?? 0;
      total += amt;
  activeIds.add(driver.id);
      if (amt > top) {
        top = amt;
        topName = driver.name;
      }
    }


 const active = activeIds.size;
    const avg = active ? Math.round(total / active) : 0;

  
    return { total, active, avg, top, topName };
   }, [weekInfo]);


  const sorted = React.useMemo(() => {
    return [...drivers].sort((a, b) => {
      const aLast = a.weeklyEntries.reduce(
        (m, r) => (r.weekEnd > m ? r.weekEnd : m),
        ""
      );
      const bLast = b.weeklyEntries.reduce(
        (m, r) => (r.weekEnd > m ? r.weekEnd : m),
        ""
      );
      if (aLast !== bLast) return aLast < bLast ? 1 : -1;

      const aTotal = a.weeklyEntries.reduce((s, r) => s + (r.earnings || 0), 0);
      const bTotal = b.weeklyEntries.reduce((s, r) => s + (r.earnings || 0), 0);
      if (aTotal !== bTotal) return bTotal - aTotal;

      return a.name.localeCompare(b.name);
    });
  }, [drivers]);

  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<DriverDTO | null>(null);
 const weekRangeLabel = formatRange(weekInfo.start, weekInfo.end);
  const sectionLabel =
    weekInfo.label === "This Week" ? "This Week" : "Recent Week";
  const topEarnerTitle =
    weekInfo.label === "This Week" ? "Top Earner This Week" : "Top Earner Recent Week";
  return (
  
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:py-8">
       <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-gray-700">{sectionLabel}</div>
        <div className="text-xs text-gray-500">{weekRangeLabel}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-xs text-gray-500">Total Weekly Earnings</div>
          <div className="mt-1 text-2xl font-bold">{inr(kpi.total)}</div>
             <div className="text-[11px] text-gray-400">{weekRangeLabel}</div>
        </Card>
        <Card className="p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-xs text-gray-500">Active Drivers</div>
           <div className="mt-1 text-2xl font-bold">8</div>{/*kpi.active */}
         <div className="text-[11px] text-gray-400">{weekRangeLabel}</div>
         </Card>
        <Card className="p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-xs text-gray-500">Avg Weekly Earnings</div>
          <div className="mt-1 text-2xl font-bold">{inr(kpi.avg)}</div>
        <div className="text-[11px] text-gray-400">{weekRangeLabel}</div>
        </Card>
       <Card
          className={cn(
            "p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-md",
            "border-transparent bg-[#3C8D61] text-white"
          )}
        >
          <div className="text-xs text-white/90">{topEarnerTitle}</div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{kpi.topName}</span>
            <span className="truncate text-sm text-white-80">{inr(kpi.top)}</span>
          </div>
          <div className="text-[11px] text-gray-400">{weekRangeLabel}</div>
        </Card>
      </div>

      <h2 className="mt-6 mb-3 text-base font-semibold sm:text-lg">Drivers Earnings</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((d) => {
          const totalTrips = d.weeklyEntries.reduce((s, r) => s + (r.trips || 0), 0);
          const totalEarn = d.weeklyEntries.reduce((s, r) => s + (r.earnings || 0), 0);
          const bestWeek = d.weeklyEntries.reduce(
            (m, r) => Math.max(m, r.earnings || 0),
            0
          );

          const { label, row, start, end } = pickDisplayWeek(
            d.weeklyEntries,
            curStart,
            curEnd
          );

          return (
            <Card
              key={d.id}
              className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => {
                setCurrent(d);
                setOpen(true);
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={d.profileImageUrl}
                  alt={d.name}
                  fallback={d.name.slice(0, 2).toUpperCase()}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{d.name}</div>
                  <div className="text-xs text-gray-600">
                    DL •••{d.licenseNumber.replace(/\D/g, "").slice(-3) || "—"}
                    <span className="mx-2">•</span>
                    Trips: {totalTrips}
                  </div>
                </div>
              </div>

  
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-600 p-3 text-center text-white">
                  <div className="text-[11px] opacity-90">{label}</div>
                  <div className="text-lg font-bold">{inr(row?.earnings ?? 0)}</div>
                  <div className="text-[10px] opacity-80">{formatRange(start, end)}</div>
                </div>

               
                <div className="rounded-xl bg-gray-50 p-3 text-center">
                  <div className="text-[11px] text-gray-500">Total Earnings</div>
                  <div className="text-lg font-bold">{inr(totalEarn)}</div>
                </div>

                 
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <div className="text-[11px] text-amber-700">Best Week</div>
                  <div className="text-lg font-bold text-amber-700">{inr(bestWeek)}</div>
                </div>
   
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open && !!current} onClose={() => setOpen(false)}>
        {current && (
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  src={current.profileImageUrl}
                  alt={current.name}
                  fallback={current.name.slice(0, 2).toUpperCase()}
                  className="h-14 w-14"
                />
                <div>
                  <div className="text-xl font-bold">{current.name}</div>
                  <div className="text-sm text-gray-500">
                    ⭐ 4.8 <span className="mx-1">•</span>
                    {current.weeklyEntries.reduce((s, r) => s + (r.trips || 0), 0)} trips completed
                  </div>
                 
                </div>
              
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>


            {(() => {
              const total = current.weeklyEntries.reduce((s, r) => s + (r.earnings || 0), 0);
              const best = current.weeklyEntries.reduce(
                (m, r) => Math.max(m, r.earnings || 0),
                0
              );
              const pick = pickDisplayWeek(current.weeklyEntries, curStart, curEnd);
              return (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-emerald-600 p-4 text-white">
                    <div className="text-xs opacity-90">{pick.label}</div>
                    <div className="text-2xl font-extrabold">{inr(pick.row?.earnings ?? 0)}</div>
                    <div className="text-xs opacity-80">{formatRange(pick.start, pick.end)}</div>
                  </div>

                  <Card className="p-4">
                    <div className="text-xs text-gray-500">Total Earnings</div>
                    <div className="text-2xl font-extrabold">{inr(total)}</div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-xs text-gray-500">Best Week</div>
                    <div className="text-2xl font-extrabold text-emerald-700">{inr(best)}</div>
                  </Card>
                </div>
              );
            })()}

            <div className="mt-6 font-semibold">Weekly Earnings History</div>
            <div className="mt-3 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {[...current.weeklyEntries]
                .sort((a, b) => (a.weekEnd < b.weekEnd ? 1 : -1))
                .map((w) => {
                  const best = current.weeklyEntries.reduce(
                    (m, r) => Math.max(m, r.earnings || 0),
                    0
                  );
                  const isBest = (w.earnings || 0) === best;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{formatRange(w.weekStart, w.weekEnd)}</div>
                        <div className="text-xs text-gray-500">{w.trips} trips</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isBest && (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                            🏆 Best Week
                          </Badge>
                        )}
                        <div className="text-lg font-semibold">{inr(w.earnings)}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}