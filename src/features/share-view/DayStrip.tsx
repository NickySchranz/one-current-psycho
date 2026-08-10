/**
 * One day of the shared window as a miniature of the client app's own
 * timeline: the main line carrying its slow current, and every thread
 * open that day forking away — pulled further out and waving harder the
 * louder it stood, resting flat when it was waiting or a step had been
 * decided. Thickness, colour and pull follow the client app's formulas.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import type { SharedThread } from "@/domain/share-types";
import { useTheme } from "@/ui/theme";
import { loudnessToThickness, statusStyle, threadColor } from "./timeline/geometry";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TOP = 34;
const LANE_GAP = 34;
const MAX_PULL = 12;
const PAD_L = 10;
const PAD_R = 14;

/** Wave tables scaled down for the strip; the shape language is the same. */
const AMP = [0, 0, 1.3, 1.9, 2.5, 3.1];
const LAMBDA = 48;
const TAPER = 14;

function lerpAmp(level: number): number {
  const clamped = Math.max(0, Math.min(AMP.length - 1, level));
  const lo = Math.floor(clamped);
  const hi = Math.min(AMP.length - 1, lo + 1);
  return AMP[lo] + (AMP[hi] - AMP[lo]) * (clamped - lo);
}

export type DayStripEntry = {
  thread: SharedThread;
  /** The loudness the thread held at the end of this day. */
  loudness: number;
  /** The thread rested this day: parked as waiting. */
  waiting: boolean;
  /** A step was decided or done on it this day: it rests, answered. */
  decided: boolean;
};

/** Alternate packed lanes around the main line: 0 → +1, 1 → −1, 2 → +2 … */
function signedLane(packed: number): number {
  return packed % 2 === 0 ? packed / 2 + 1 : -((packed + 1) / 2);
}

/** Directional flow dashes — one travelling offset per open line. */
function FlowDash({
  d,
  color,
  thickness,
  durationMs,
  dash,
}: {
  d: string;
  color: string;
  thickness: number;
  durationMs: number;
  dash: [number, number];
}) {
  const offset = useSharedValue(15);
  useEffect(() => {
    offset.value = 15;
    offset.value = withRepeat(
      withTiming(0, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(offset);
  }, [durationMs, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <AnimatedPath
      animatedProps={props}
      d={d}
      stroke={color}
      strokeWidth={Math.max(1.5, thickness - 1)}
      strokeDasharray={dash}
      opacity={0.85}
      fill="none"
      strokeLinecap="round"
      pointerEvents="none"
    />
  );
}

export function DayStrip({ entries }: { entries: DayStripEntry[] }) {
  const tk = useTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  // Earlier starts take the closer lanes, as in the client app.
  const ordered = [...entries].sort(
    (a, b) =>
      a.thread.startedOn.localeCompare(b.thread.startedOn) ||
      a.thread.id.localeCompare(b.thread.id),
  );
  const lanes = ordered.map((_, i) => signedLane(i));
  const above = Math.max(0, ...lanes.map((l) => (l < 0 ? -l : 0)));
  const below = Math.max(0, ...lanes.map((l) => (l > 0 ? l : 0)));
  const mainY = TOP + above * LANE_GAP;
  const height = TOP + (above + below) * LANE_GAP + 20;

  const drawing = entries.filter((e) => !e.waiting && !e.decided).length;
  const a11y =
    entries.length === 0
      ? "Nothing pulled away from the main line this day."
      : `${entries.length} shared ${entries.length === 1 ? "thread was" : "threads were"} open this day, ${drawing} actively drawing.`;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a11y}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ marginTop: 2 }}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* the main line and its slow current */}
          <Line
            x1={0}
            y1={mainY}
            x2={width}
            y2={mainY}
            stroke={tk.lineMain}
            strokeWidth={2.75}
            strokeLinecap="round"
          />
          {!reducedMotion && (
            <FlowDash
              d={`M 0 ${mainY} L ${width} ${mainY}`}
              color={tk.accent}
              thickness={2.75}
              durationMs={tk.mainFlowDuration}
              dash={tk.mainFlowDash}
            />
          )}

          {ordered.map((entry, i) => {
            const lane = lanes[i];
            const th = entry.thread;
            const resting = entry.waiting || entry.decided;
            const level = Math.max(1, Math.min(5, entry.loudness));
            const pull = ((level - 1) / 4) * MAX_PULL;
            const laneY = mainY + lane * LANE_GAP + Math.sign(lane) * pull;
            const forkX = PAD_L + i * 20;
            const endX = width - PAD_R;
            const curve = 30;
            const runStart = Math.min(forkX + curve, endX);

            // Fork curve as in the client app, then a run carrying a baked
            // wave — its amplitude is the day's loudness; resting lies flat.
            let d = `M ${forkX} ${mainY}`;
            d += ` C ${forkX + curve * 0.5} ${mainY}, ${forkX + curve * 0.4} ${laneY}, ${runStart} ${laneY}`;
            const amp = resting || reducedMotion ? 0 : lerpAmp(level);
            if (amp > 0) {
              for (let x = runStart + 6; x <= endX; x += 6) {
                const s = x - runStart;
                const taper = Math.min(1, s / TAPER, (endX - x) / TAPER);
                const off = amp * taper * Math.sin((2 * Math.PI * s) / LAMBDA);
                d += ` L ${x} ${(laneY + off).toFixed(2)}`;
              }
            }
            d += ` L ${endX} ${laneY}`;

            const style = statusStyle(th.status);
            const color = threadColor(th, tk.mode, style.saturation);
            const thickness = loudnessToThickness(level);
            const opacity = entry.waiting ? 0.45 : style.opacity;

            const feelings = th.feelings?.slice(0, 3).join(", ");
            const title = th.title.length > 30 ? th.title.slice(0, 28) + "…" : th.title;
            const label =
              title +
              (entry.waiting ? " · waiting" : entry.decided ? " · a step decided" : "") +
              (feelings ? ` — holds ${feelings}` : "");
            const labelY = laneY - 8;

            return (
              <G key={th.id}>
                <Path
                  d={d}
                  stroke={color}
                  strokeWidth={thickness}
                  opacity={opacity}
                  fill="none"
                  strokeLinecap="round"
                />
                {!resting && !reducedMotion && (
                  <FlowDash
                    d={d}
                    color={color}
                    thickness={thickness}
                    durationMs={tk.flowDuration}
                    dash={tk.flowDash}
                  />
                )}
                <Circle
                  cx={forkX}
                  cy={mainY}
                  r={3.5}
                  stroke={color}
                  strokeWidth={2}
                  fill={tk.bg}
                />
                <Circle cx={endX - 2} cy={laneY} r={4} fill={color} opacity={opacity} />
                {/* the loudness level, spelled out at the line's end */}
                <SvgText
                  x={endX - 10}
                  y={labelY}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight="600"
                  fontFamily={tk.fontBody}
                  fill={color}
                >
                  {`${Math.round(level * 10) / 10}`}
                </SvgText>
                {/* label with a stroked twin for readability */}
                <SvgText
                  x={runStart + 4}
                  y={labelY}
                  fontSize={11.5}
                  fontWeight="600"
                  fontFamily={tk.fontBody}
                  stroke={tk.bg}
                  strokeWidth={4}
                  fill={tk.bg}
                >
                  {label}
                </SvgText>
                <SvgText
                  x={runStart + 4}
                  y={labelY}
                  fontSize={11.5}
                  fontWeight="600"
                  fontFamily={tk.fontBody}
                  fill={color}
                >
                  {label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
