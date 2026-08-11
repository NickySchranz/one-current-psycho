import type { StoredShare } from "@/db/database";
import type { ShareExport } from "@/domain/share-types";
import { ALL_KINDS, type EventKind } from "./kinds";

/**
 * "What's new since the last session" uses the previous share file's `to`
 * date as the baseline: shares arrive at session cadence, so everything up
 * to that date has already been seen. No extra state, and re-opening the
 * screen never loses the highlight.
 */

/** The `to` day of the client's previous share, or null if this is the first. */
export function previousShareTo(current: StoredShare, all: StoredShare[]): string | null {
  let best: string | null = null;
  for (const sh of all) {
    if (sh.clientId !== current.clientId || sh.id === current.id) continue;
    const to = sh.data.to.slice(0, 10);
    if (to >= current.data.to.slice(0, 10)) continue;
    if (best === null || to > best) best = to;
  }
  return best;
}

const PHRASES: Record<EventKind, [one: string, many: string]> = {
  started: ["thread started", "threads started"],
  moment: ["moment", "moments"],
  "action-decided": ["step decided", "steps decided"],
  "action-done": ["step done", "steps done"],
  integrated: ["thread integrated", "threads integrated"],
};

/** Counts events after `baseline` (a day) and words them for the summary. */
export function whatsNew(
  share: ShareExport,
  baseline: string,
): { total: number; summary: string } {
  const counts = new Map<EventKind, number>();
  for (const th of share.threads) {
    for (const e of th.events) {
      if (e.on.slice(0, 10) > baseline) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    }
  }
  const parts = ALL_KINDS.flatMap((kind) => {
    const n = counts.get(kind) ?? 0;
    return n > 0 ? [`${n} ${PHRASES[kind][n === 1 ? 0 : 1]}`] : [];
  });
  return {
    total: parts.length === 0 ? 0 : [...counts.values()].reduce((a, b) => a + b, 0),
    summary: parts.join(", "),
  };
}
