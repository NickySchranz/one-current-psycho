import type { Client, SessionNote, StoredShare } from "@/db/database";
import { isClosedThread } from "@/features/share-view/timeline/geometry";

/** A quick read on a client: what they shared, and when something last moved. */
export type ClientSummary = {
  shareCount: number;
  /** Export time of the most recent share, if any. */
  latestExportedAt?: string;
  /** Open threads in the most recent share — the freshest picture we hold. */
  openThreads: number;
  /** Date of the most recent session note, if any. */
  lastNoteOn?: string;
  /** The most recent of: latest export, latest note, the client's creation. */
  lastActivity: string;
};

export function clientSummary(
  client: Client,
  shares: StoredShare[],
  notes: SessionNote[],
): ClientSummary {
  const own = shares.filter((sh) => sh.clientId === client.id);
  const latest = own.reduce<StoredShare | undefined>(
    (best, sh) =>
      !best || sh.data.exportedAt > best.data.exportedAt ? sh : best,
    undefined,
  );
  const lastNoteOn = notes
    .filter((n) => n.clientId === client.id)
    .reduce<string | undefined>((best, n) => {
      const on = n.on ?? n.createdAt.slice(0, 10);
      return !best || on > best ? on : best;
    }, undefined);

  let lastActivity = client.createdAt;
  if (latest && latest.data.exportedAt > lastActivity) {
    lastActivity = latest.data.exportedAt;
  }
  if (lastNoteOn && lastNoteOn > lastActivity) lastActivity = lastNoteOn;

  return {
    shareCount: own.length,
    latestExportedAt: latest?.data.exportedAt,
    openThreads: latest
      ? latest.data.threads.filter((th) => !isClosedThread(th)).length
      : 0,
    lastNoteOn,
    lastActivity,
  };
}

/** Most recently active clients first. */
export function byRecentActivity(
  a: { summary: ClientSummary },
  b: { summary: ClientSummary },
): number {
  return b.summary.lastActivity.localeCompare(a.summary.lastActivity);
}
