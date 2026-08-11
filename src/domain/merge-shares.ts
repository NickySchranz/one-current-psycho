import type {
  ShareExport,
  SharedEvent,
  SharedLoudnessEntry,
  SharedThread,
} from "./share-types";

/**
 * Merge every share file a client handed over into one continuous export
 * spanning the full date range.
 *
 * Each export is windowed — events and loudness changes before its `from`
 * are absent — so a newer file is not a superset of an older one and the
 * histories must be unioned. Thread ids are stable across exports from the
 * same client app; the newest version of a thread carries its current
 * metadata (status, beliefs, integration), while events and loudness are
 * collected across all versions.
 *
 * Requires shares.length >= 1.
 */
export function mergeShares(shares: readonly ShareExport[]): ShareExport {
  // The same file imported twice has the same exportedAt — keep one.
  const unique = [...new Map(shares.map((s) => [s.exportedAt, s])).values()].sort((a, b) =>
    a.exportedAt.localeCompare(b.exportedAt),
  );
  if (unique.length === 1) return unique[0];

  // Walk oldest → newest so newer versions overwrite older ones, while
  // threads keep the order of their first appearance.
  const threads = new Map<string, SharedThread>();
  for (const share of unique) {
    for (const thread of share.threads) {
      const seen = threads.get(thread.id);
      threads.set(thread.id, seen ? mergeThread(seen, thread) : thread);
    }
  }

  return {
    app: "one-current-share",
    version: 1,
    exportedAt: unique[unique.length - 1].exportedAt,
    from: unique.reduce((min, s) => (s.from < min ? s.from : min), unique[0].from),
    to: unique.reduce((max, s) => (s.to > max ? s.to : max), unique[0].to),
    threads: [...threads.values()],
  };
}

/** `older` merged into `newer`: newest metadata wins, histories union. */
function mergeThread(older: SharedThread, newer: SharedThread): SharedThread {
  return {
    ...newer,
    startedOn: older.startedOn < newer.startedOn ? older.startedOn : newer.startedOn,
    events: mergeEvents(older.events, newer.events),
    loudness: mergeLoudness(older.loudness, newer.loudness),
  };
}

function eventKey(e: SharedEvent): string {
  return `${e.on.slice(0, 10)}|${e.kind}|${"title" in e ? e.title : ""}`;
}

function mergeEvents(older: SharedEvent[], newer: SharedEvent[]): SharedEvent[] {
  // Newer versions of the same event may carry added fields — they win.
  const byKey = new Map<string, SharedEvent>();
  for (const e of older) byKey.set(eventKey(e), e);
  for (const e of newer) byKey.set(eventKey(e), e);
  return [...byKey.values()].sort((a, b) => a.on.localeCompare(b.on));
}

function mergeLoudness(
  older: SharedLoudnessEntry[],
  newer: SharedLoudnessEntry[],
): SharedLoudnessEntry[] {
  // A newer file's pre-window "baseline" entry is a real earlier entry, so
  // deduping by exact timestamp collapses it naturally.
  const byAt = new Map<string, SharedLoudnessEntry>();
  for (const l of older) byAt.set(l.at, l);
  for (const l of newer) byAt.set(l.at, l);
  return [...byAt.values()].sort((a, b) => a.at.localeCompare(b.at));
}
