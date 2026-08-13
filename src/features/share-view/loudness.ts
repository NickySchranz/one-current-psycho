/** Shared loudness utilities used by the pulse, thread list and detail. */
import type { SharedThread } from "@/domain/share-types";

/** The thread's most recent loudness, or 2 when there's no history. */
export function loudnessNow(th: SharedThread): number {
  return th.loudness.length > 0 ? th.loudness[th.loudness.length - 1].loudness : 2;
}

/** Trend arrow: ↑ rising, ↓ falling, → stable (within 0.3). */
export function loudnessTrend(th: SharedThread): "↑" | "↓" | "→" {
  if (th.loudness.length < 2) return "→";
  const first = th.loudness[0].loudness;
  const last = th.loudness[th.loudness.length - 1].loudness;
  const diff = last - first;
  if (diff > 0.3) return "↑";
  if (diff < -0.3) return "↓";
  return "→";
}
