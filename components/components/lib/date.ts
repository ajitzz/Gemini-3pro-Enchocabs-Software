// Shared date & currency helpers (SSR/CSR-safe, Asia/Kolkata)

export function toDate(isoYYYYMMDD: string): Date {
  // Force local midnight in IST to avoid off-by-one in UTC conversions
  return new Date(`${isoYYYYMMDD}T00:00:00+05:30`);
}

// Monday–Sunday bounds in Asia/Kolkata
export function getWeekBounds(weekStartISO: string) {
  const start = toDate(weekStartISO); // expected Monday
  const day = start.getDay(); // 0 Sun..6 Sat (local)
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
export function toUTCISODateString(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysToISODate(isoYYYYMMDD: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoYYYYMMDD)) {
    return isoYYYYMMDD;
  }

  const [y, m, d] = isoYYYYMMDD.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);

  return toUTCISODateString(dt);
}



// Key for grouping: Monday ISO (YYYY-MM-DD)
export function getWeekKeyISO(isoLike: string) {
  const d = toDate(isoLike);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// "3 Nov – 9 Nov" style (Mon–Sun)
export function formatWeekRange(weekStartISO: string) {
  const { start, end } = getWeekBounds(weekStartISO);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function formatINR(n: number | string) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(num));
}
