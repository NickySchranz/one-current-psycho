/**
 * Read-only replica of the client app's timeline geometry: signed lanes
 * around a main line, fork/merge cubic curves, loudness as thickness and
 * as a pull away from the main line. Formulas mirror one-current-app's
 * visualization/branch-lines so a share looks like what the client sees —
 * with one addition: the run steps with the shared loudness history.
 */
import type { SharedThread } from "@/domain/share-types";
import type { DateScale } from "./date-scale";

/* ---------- constants shared with the client app ---------- */

export const TOP_PAD = 58;
export const BOTTOM_PAD = 48;
export const AXIS_H = 26;
export const LANE_GAP = 52;
export const LANE_GAP_COMPACT = 40;
export const CURVE_LENGTH = 64;
export const CURVE_LENGTH_COMPACT = 40;
const LANE_CLEARANCE = 26;

/** Emotional loudness maps to line thickness: heavier threads are heavier lines. */
export function loudnessToThickness(loudness: number): number {
  return 1.25 + loudness * 0.75; // 2 .. 5 px
}

/** Statuses whose line ends on the main line instead of reaching the window end. */
const CLOSED_STATUSES = new Set(["merged", "converted-to-project", "archived"]);

export function isClosedThread(thread: SharedThread): boolean {
  return CLOSED_STATUSES.has(thread.status) || !!thread.integratedOn;
}

/** Status maps to opacity and colour saturation, as in the client app. */
export function statusStyle(status: string): {
  opacity: number;
  saturation: "muted" | "normal" | "raised";
} {
  switch (status) {
    case "activated":
    case "merge-conflict":
    case "needs-support":
      return { opacity: 1, saturation: "raised" };
    case "explored":
      return { opacity: 0.85, saturation: "normal" };
    case "ready-to-merge":
      return { opacity: 0.9, saturation: "normal" };
    case "converted-to-project":
      return { opacity: 0.8, saturation: "normal" };
    case "partly-integrated":
      return { opacity: 0.7, saturation: "muted" };
    case "merged":
      return { opacity: 0.45, saturation: "muted" };
    case "archived":
      return { opacity: 0.3, saturation: "muted" };
    default:
      return { opacity: 0.95, saturation: "normal" };
  }
}

/* ---------- colour: stable per thread, hue family per kind ---------- */

const TYPE_HUE: Record<string, number> = {
  event: 215, // slate blue
  waiting: 190, // calm teal
  projection: 260, // dusk violet
  identity: 330, // muted plum
  relationship: 10, // soft clay
  body: 90, // moss
  project: 40, // ochre
};

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function threadColor(
  thread: Pick<SharedThread, "id" | "kind">,
  mode: "light" | "dark",
  saturation: "muted" | "normal" | "raised" = "normal",
): string {
  const baseHue = TYPE_HUE[thread.kind] ?? 215;
  const hue = (baseHue + (hash(thread.id) % 24) - 12 + 360) % 360;
  const sat = saturation === "raised" ? 46 : saturation === "muted" ? 18 : 32;
  const lig = mode === "dark" ? 68 : 42;
  return `hsl(${hue} ${sat}% ${lig}%)`;
}

/* ---------- lanes: alternate below/above the main line ---------- */

/** Alternate packed lanes around the main line: 0 → +1, 1 → −1, 2 → +2, 3 → −2 … */
function signedLane(packed: number): number {
  return packed % 2 === 0 ? packed / 2 + 1 : -((packed + 1) / 2);
}

export type LaneAssignment = { threadId: string; lane: number };

/**
 * Earlier starts take the closer lanes. Open threads all reach the window
 * end, so they never share a lane; closed threads may reuse a freed lane.
 */
export function assignLanes(threads: SharedThread[], to: string): LaneAssignment[] {
  const items = threads
    .map((th) => ({
      thread: th,
      start: th.startedOn,
      end: isClosedThread(th) ? (th.integratedOn ?? to) : "9999-12-31",
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.thread.id.localeCompare(b.thread.id));

  const laneEnds: string[] = [];
  const result: LaneAssignment[] = [];
  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end < item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    result.push({ threadId: item.thread.id, lane: signedLane(lane) });
  }
  return result;
}

export function laneExtents(assignments: LaneAssignment[]): { above: number; below: number } {
  let above = 0;
  let below = 0;
  for (const a of assignments) {
    if (a.lane > 0) below = Math.max(below, a.lane);
    else above = Math.max(above, -a.lane);
  }
  return { above, below };
}

/* ---------- per-thread drawable geometry ---------- */

export type EventPoint = {
  /** Index into thread.events. */
  index: number;
  x: number;
  y: number;
};

export type ThreadGeometry = {
  threadId: string;
  /** Full SVG path: fork curve, stepped run, optional merge curve back. */
  path: string;
  forkVisible: boolean;
  forkX: number;
  endX: number;
  endY: number;
  /** True when the line terminates on the main line (integrated). */
  endsOnMain: boolean;
  laneY: number;
  thickness: number;
  /** The last shared loudness level — drives the slither. */
  endLoudness: number;
  /** True when the thread was still open at the window end. */
  open: boolean;
  opacity: number;
  color: string;
  /** Markers for moment / step events along the line. */
  eventPoints: EventPoint[];
  labelX: number;
  labelY: number;
  labelAnchor: "end" | undefined;
  labelVisible: boolean;
  label: string;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function buildThreadGeometry(
  thread: SharedThread,
  lane: number,
  scale: DateScale,
  metrics: { mainY: number; laneGap: number; curveLength: number; mode: "light" | "dark" },
  from: string,
  to: string,
): ThreadGeometry {
  const { mainY, laneGap, curveLength, mode } = metrics;
  const closed = isClosedThread(thread);
  const style = statusStyle(thread.status);
  const color = threadColor(thread, mode, style.saturation);

  // Louder threads sit further from the main line; the pull never closes the
  // clearance to the next lane.
  const maxPull = Math.min(0.45 * laneGap, Math.max(0, laneGap - LANE_CLEARANCE));
  const baseY = mainY + lane * laneGap;
  const yFor = (loudness: number) =>
    baseY + Math.sign(lane) * ((clamp(loudness, 1, 5) - 1) / 4) * maxPull;

  // The loudness history steps the run: each shared change moves the line.
  const log = thread.loudness;
  const startLoudness = log.length > 0 ? log[0].loudness : 2;
  const endLoudness = log.length > 0 ? log[log.length - 1].loudness : 2;

  const forkVisible = thread.startedOn >= from;
  const forkX = scale.x(thread.startedOn);
  const endX = closed && thread.integratedOn ? scale.x(thread.integratedOn) : scale.right;
  const startY = yFor(startLoudness);

  const curve = Math.min(curveLength, Math.max(24, (endX - forkX) * 0.25));
  const forkEndX = forkVisible ? Math.min(forkX + curve, endX) : scale.left;
  const runEnd = closed ? Math.max(forkEndX, endX - curve) : endX;

  let d: string;
  if (forkVisible) {
    d = `M ${forkX} ${mainY}`;
    d += ` C ${forkX + curve * 0.5} ${mainY}, ${forkX + curve * 0.4} ${startY}, ${forkEndX} ${startY}`;
  } else {
    d = `M ${scale.left} ${startY}`;
  }

  // Stepped run: hold each loudness level, then ease to the next over 14px.
  const STEP = 14;
  const segments: { x: number; y: number }[] = [{ x: forkEndX, y: startY }];
  let curX = forkEndX;
  let curY = startY;
  for (const entry of log) {
    const ex = clamp(scale.x(entry.at), forkEndX, runEnd);
    const ny = yFor(entry.loudness);
    if (ny === curY) continue;
    const holdTo = Math.max(curX, Math.min(ex, runEnd - STEP));
    d += ` L ${holdTo} ${curY}`;
    const stepTo = Math.min(holdTo + STEP, runEnd);
    d += ` C ${holdTo + STEP * 0.5} ${curY}, ${holdTo + STEP * 0.5} ${ny}, ${stepTo} ${ny}`;
    curX = stepTo;
    curY = ny;
    segments.push({ x: holdTo, y: ny });
  }
  d += ` L ${runEnd} ${curY}`;

  let endY = curY;
  let endsOnMain = false;
  if (closed) {
    d += ` C ${endX - curve * 0.4} ${curY}, ${endX - curve * 0.5} ${mainY}, ${endX} ${mainY}`;
    endY = mainY;
    endsOnMain = true;
  }

  const yAt = (x: number): number => {
    let y = segments[0].y;
    for (const s of segments) {
      if (s.x <= x) y = s.y;
      else break;
    }
    return y;
  };

  // Moment and step markers sit on the line; started/integrated are drawn
  // as the fork and merge points themselves. Same-day markers fan out.
  const eventPoints: EventPoint[] = [];
  const dayCounts = new Map<string, number>();
  thread.events.forEach((e, index) => {
    if (e.kind === "started" || e.kind === "integrated") return;
    const seen = dayCounts.get(e.on) ?? 0;
    dayCounts.set(e.on, seen + 1);
    const x = clamp(scale.x(e.on) + seen * 9, forkEndX, runEnd);
    eventPoints.push({ index, x, y: yAt(x) });
  });

  const truncated =
    thread.title.length > 34 ? thread.title.slice(0, 32) + "…" : thread.title;
  const label = truncated + ((thread.returnedCount ?? 0) > 0 ? " · returned" : "");
  const runStart = forkEndX;
  const labelX = closed
    ? Math.max(forkEndX + 8, runStart + (runEnd - runStart) * 0.35)
    : endX - 12;
  const labelAnchor = closed ? undefined : ("end" as const);

  return {
    threadId: thread.id,
    path: d,
    forkVisible,
    forkX,
    endX,
    endY,
    endsOnMain,
    laneY: baseY,
    thickness: loudnessToThickness(endLoudness),
    endLoudness,
    open: !closed,
    opacity: style.opacity,
    color,
    eventPoints,
    labelX,
    labelY: yAt(labelX) - 7,
    labelAnchor,
    labelVisible: !closed || runEnd - runStart > 48,
    label,
  };
}
