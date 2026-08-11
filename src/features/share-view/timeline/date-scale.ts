import { daysBetween } from "@/domain/dates";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

export type DateScale = {
  left: number;
  right: number;
  /** Linear x for an ISO date or timestamp, clamped to [left, right]. */
  x: (iso: string) => number;
  ticks: { x: number; label: string }[];
};

/** A linear day scale over the shared window [from, to]. */
export function makeDateScale(
  from: string,
  to: string,
  left: number,
  right: number,
): DateScale {
  const total = Math.max(1, daysBetween(from, to));
  const x = (iso: string) => {
    const d = daysBetween(from, iso);
    const frac = Math.min(1, Math.max(0, d / total));
    return left + frac * (right - left);
  };
  // Weekly ticks; fortnightly, then four-weekly, when the window is long
  // enough to crowd them (combined histories can span many months).
  const step = total > 180 ? 28 : total > 70 ? 14 : 7;
  const ticks: { x: number; label: string }[] = [];
  const fromMs = Date.parse(from.slice(0, 10) + "T00:00:00Z");
  for (let d = 0; d <= total; d += step) {
    const iso = new Date(fromMs + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    ticks.push({ x: x(iso), label: shortDay(iso) });
  }
  return { left, right, x, ticks };
}
