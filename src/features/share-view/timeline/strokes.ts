/**
 * Stroke animation for one shared thread line, replicating the client
 * app's Reanimated model: the true geometry is sampled once in JS and a
 * worklet rewrites the path's `d` each frame with a travelling sine
 * offset — the line slithers with its loudness while both ends stay
 * anchored. A freshly opened share draws itself in; open lines carry
 * directional flow dashes toward the window end.
 */
import { useEffect, useMemo } from "react";
import {
  cancelAnimation,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { PathProps } from "react-native-svg";
import { pathLength, samplePath, type SamplePoint } from "./path-sample";

// Same tables as the client app: louder = wider, faster, tighter wavelength.
const AMP = [0, 0, 1.8, 2.6, 3.4, 4.2]; // px, half-width of the wave
const SPEED = [0, 0, 0.8, 1.3, 2.1, 3.2]; // wave cycles per second
const LAMBDA = [56, 56, 56, 48, 40, 34]; // px of line per wave cycle
const TAPER = 18; // px over which the wave fades to zero at both ends

/** Linear blend between neighbouring table entries for fractional levels. */
function lerpTable(table: number[], level: number): number {
  "worklet";
  const clamped = Math.max(0, Math.min(table.length - 1, level));
  const lo = Math.floor(clamped);
  const hi = Math.min(table.length - 1, lo + 1);
  return table[lo] + (table[hi] - table[lo]) * (clamped - lo);
}

export type ThreadStrokeProps = {
  /** For the visible line: squiggle `d` + the draw-in dash. */
  line: Partial<PathProps>;
  /** For the directional flow dashes: squiggle `d` + travelling dashoffset. */
  flow: Partial<PathProps>;
};

export function useThreadStrokes(opts: {
  /** The slither: only while the line is loud and still open. */
  trembling: boolean;
  level: number;
  basePath: string;
  /** Stagger of the mount draw-in, ms. */
  drawInDelay: number;
  flowing: boolean;
  flowDurationMs: number;
  reducedMotion: boolean;
}): ThreadStrokeProps {
  const { trembling, level, basePath, drawInDelay, flowing, flowDurationMs, reducedMotion } =
    opts;

  const alive = trembling && !reducedMotion;
  const pts = useMemo<SamplePoint[]>(
    () => (alive ? samplePath(basePath) : []),
    [alive, basePath],
  );
  const total = pts.length > 0 ? pts[pts.length - 1].s : 0;

  // Time in seconds, ticking while the slither is active.
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!alive || pts.length === 0) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(3600, { duration: 3600_000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [alive, pts, clock]);

  // The squiggled path, built once per frame and shared by both strokes.
  const d = useDerivedValue(() => {
    if (!alive || pts.length === 0) return basePath;
    const amp = lerpTable(AMP, level);
    const k = (2 * Math.PI) / lerpTable(LAMBDA, level);
    const omega = 2 * Math.PI * lerpTable(SPEED, level);
    const t = clock.value;
    let out = "";
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const taper = Math.min(1, p.s / TAPER, (total - p.s) / TAPER);
      const off = amp * taper * Math.sin(k * p.s - omega * t);
      out += `${out ? "L" : "M"}${(p.x + p.nx * off).toFixed(2)} ${(p.y + p.ny * off).toFixed(2)}`;
    }
    return out;
  }, [alive, pts, level, basePath, total]);

  // Draw-in on mount: dash the full length, sweep the offset to zero.
  // The dash rides the squiggled path, which is slightly longer than the
  // base geometry — pad the length so the line's end never falls into the
  // dash gap and pops in late.
  const drawing = !reducedMotion;
  const drawLen = useMemo(
    () => (drawing ? pathLength(basePath) * 1.08 + 24 : 0),
    [drawing, basePath],
  );
  const drawOffset = useSharedValue(0);
  useEffect(() => {
    if (!drawing || drawLen <= 0) return;
    drawOffset.value = drawLen;
    drawOffset.value = withDelay(
      drawInDelay,
      withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(drawOffset);
    // Draw in once per mounted line; a resize just keeps the finished state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Directional flow toward the window end.
  const flowActive = flowing && !reducedMotion;
  const flowOffset = useSharedValue(15);
  useEffect(() => {
    if (!flowActive) {
      cancelAnimation(flowOffset);
      flowOffset.value = 15;
      return;
    }
    flowOffset.value = 15;
    flowOffset.value = withRepeat(
      withTiming(0, { duration: flowDurationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(flowOffset);
  }, [flowActive, flowDurationMs, flowOffset]);

  const line = useAnimatedProps<PathProps>(() => {
    if (drawing && drawLen > 0 && drawOffset.value > 0.5) {
      return {
        d: d.value,
        strokeDasharray: [drawLen, drawLen],
        strokeDashoffset: drawOffset.value,
      };
    }
    // Reset the draw-in dash explicitly — animated props only apply the keys
    // they return, and a dash far longer than any path is a solid stroke.
    return { d: d.value, strokeDasharray: [1e6, 1e6], strokeDashoffset: 0 };
  }, [drawing, drawLen, d]);

  const flow = useAnimatedProps<PathProps>(
    () => ({ d: d.value, strokeDashoffset: flowOffset.value }),
    [d],
  );

  return { line, flow };
}

/** The travelling dashes of the main line — one shared value for the chart. */
export function useMainFlow(durationMs: number, reducedMotion: boolean) {
  const offset = useSharedValue(56);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(offset);
      offset.value = 56;
      return;
    }
    offset.value = 56;
    offset.value = withRepeat(
      withTiming(0, { duration: durationMs * 2, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(offset);
  }, [durationMs, reducedMotion, offset]);
  return useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
}
