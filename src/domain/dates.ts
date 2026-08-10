const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-07-27" (or an ISO timestamp) → "27 Jul 2026", timezone-safe. */
export function fmtDay(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Days between two ISO dates (date part only). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const to = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}
