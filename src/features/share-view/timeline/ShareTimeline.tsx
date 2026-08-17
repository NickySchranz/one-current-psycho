import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import type { ShareExport } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { alpha } from "@/ui/color";
import { Hint } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { makeDateScale } from "./date-scale";
import {
  AXIS_H,
  BOTTOM_PAD,
  CURVE_LENGTH,
  CURVE_LENGTH_COMPACT,
  LANE_GAP,
  LANE_GAP_COMPACT,
  TOP_PAD,
  assignLanes,
  buildThreadGeometry,
  laneExtents,
  type ThreadGeometry,
} from "./geometry";
import { useMainFlow, useThreadStrokes } from "./strokes";
import type { Selection } from "../selection";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const PAD_L = 12;
const PAD_R = 20;
const MIN_WIDTH = 640;
/** Opacity a group steps back to while another line holds the focus. */
const DIM = 0.35;

/**
 * `.branch-dimmed` — the whole group eases back over 250ms. With a delay,
 * the group also fades in on mount, so markers arrive with their line's
 * draw-in instead of floating before it exists.
 */
function useDimProps(dimmed: boolean, appearDelayMs = 0) {
  const v = useSharedValue(dimmed ? DIM : 1);
  const appeared = useSharedValue(appearDelayMs > 0 ? 0 : 1);
  useEffect(() => {
    v.value = withTiming(dimmed ? DIM : 1, {
      duration: 250,
      easing: Easing.inOut(Easing.ease),
    });
  }, [dimmed, v]);
  useEffect(() => {
    if (appearDelayMs > 0) {
      appeared.value = withDelay(
        appearDelayMs,
        withTiming(1, { duration: 450, easing: Easing.out(Easing.ease) }),
      );
    }
    // Appear once per mounted group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedProps(() => ({ opacity: v.value * appeared.value }));
}

/**
 * Pass one — one thread's strokes: a generous hit area, the visible line
 * (drawing itself in when the share opens, slithering with its loudness
 * while open), and directional flow dashes toward the window end.
 */
function ThreadLine({
  g,
  index,
  focused,
  dimmed,
  reducedMotion,
  onPress,
}: {
  g: ThreadGeometry;
  index: number;
  focused: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const tk = useTheme();
  const strokes = useThreadStrokes({
    trembling: g.open && g.endLoudness > 1,
    level: g.endLoudness,
    basePath: g.path,
    drawInDelay: 90 * index,
    flowing: g.open,
    flowDurationMs: tk.flowDuration,
    reducedMotion,
  });
  const groupProps = useDimProps(dimmed);

  return (
    <AnimatedG animatedProps={groupProps}>
      {/* generous invisible hit area — the true geometry, never squiggled */}
      <Path d={g.path} stroke="transparent" strokeWidth={22} fill="none" onPress={onPress} />
      <AnimatedPath
        animatedProps={strokes.line}
        stroke={g.color}
        strokeWidth={focused ? g.thickness + 1.25 : g.thickness}
        opacity={g.opacity}
        fill="none"
        strokeLinecap="round"
        pointerEvents="none"
      />
      {/* subtle directional movement toward the present */}
      {g.open && (
        <AnimatedPath
          animatedProps={strokes.flow}
          stroke={g.color}
          strokeWidth={Math.max(1.5, g.thickness - 1)}
          strokeDasharray={tk.flowDash}
          opacity={0.85}
          fill="none"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
    </AnimatedG>
  );
}

/**
 * The whole share as one summarized timeline, drawn the way the client's
 * own app draws their life: a main line with each shared thread forking
 * away, pulled further out the louder it felt, curving back when it
 * integrated. Open lines slither with their loudness, exactly like the
 * client's own view. Tap a line or a marker for the full detail.
 *
 * Selection is owned by the screen: the chart stays put while the content
 * below it changes.
 */
export function ShareTimeline({
  share,
  selection,
  onSelect,
}: {
  share: ShareExport;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const tk = useTheme();
  const reducedMotion = useReducedMotion();
  const [containerW, setContainerW] = useState(0);

  const width = Math.max(containerW, MIN_WIDTH);
  const compact = width < 760;
  const curveLength = compact ? CURVE_LENGTH_COMPACT : CURVE_LENGTH;

  const { scale, geometries, mainY, height } = useMemo(() => {
    const scale = makeDateScale(share.from, share.to, PAD_L, width - PAD_R);
    const lanes = assignLanes(share.threads, share.to);
    const { above, below } = laneExtents(lanes);
    // Tight lanes only while they stay readable — with many lanes the chart
    // grows vertically instead (the page scrolls; crowding doesn't).
    const laneGap = compact && above + below <= 6 ? LANE_GAP_COMPACT : LANE_GAP;
    const mainY = TOP_PAD + above * laneGap;
    const height = TOP_PAD + (above + below) * laneGap + BOTTOM_PAD + AXIS_H;
    const metrics = { mainY, laneGap, curveLength, mode: tk.mode };
    const geometries = share.threads.map((th) => {
      const lane = lanes.find((l) => l.threadId === th.id)?.lane ?? 1;
      return buildThreadGeometry(th, lane, scale, metrics, share.from, share.to);
    });
    return { scale, geometries, mainY, height };
  }, [share, width, compact, curveLength, tk.mode]);

  const mainFlowProps = useMainFlow(tk.mainFlowDuration, reducedMotion);

  if (share.threads.length === 0) {
    return <Hint>This share holds no threads.</Hint>;
  }

  /** Fork/merge points select their started/integrated event when shared. */
  const selectBoundary = (threadId: string, kind: "started" | "integrated") => {
    const thread = share.threads.find((th) => th.id === threadId);
    const index = thread?.events.findIndex((e) => e.kind === kind) ?? -1;
    onSelect(
      index >= 0 ? { type: "event", threadId, index } : { type: "thread", threadId },
    );
  };

  const chart = (
    <Svg width={width} height={height}>
      {/* date axis along the bottom */}
      {scale.ticks.map((tick) => (
        <G key={tick.x}>
          <Line
            x1={tick.x}
            y1={TOP_PAD - 26}
            x2={tick.x}
            y2={height - AXIS_H}
            stroke={alpha(tk.lineAxis, 0.5)}
            strokeWidth={1}
          />
          <SvgText
            x={tick.x}
            y={height - 8}
            fontSize={11}
            fontFamily={tk.fontBody}
            fill={tk.inkFaint}
            textAnchor={tick.x < PAD_L + 16 ? "start" : "middle"}
          >
            {tick.label}
          </SvgText>
        </G>
      ))}

      {/* the main line: the client's one current, with its slow current */}
      <Line
        x1={0}
        y1={mainY}
        x2={width}
        y2={mainY}
        stroke={tk.lineMain}
        strokeWidth={3.25}
        strokeLinecap="round"
      />
      <AnimatedPath
        animatedProps={mainFlowProps}
        d={`M 0 ${mainY} L ${width} ${mainY}`}
        stroke={tk.accent}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={tk.mainFlowDash}
        opacity={0.7}
        pointerEvents="none"
      />

      {/* pass one — every line and its hit area, so no line ever covers
          another thread's markers */}
      {share.threads.map((th, i) => {
        const focused = selection?.threadId === th.id;
        return (
          <ThreadLine
            key={th.id}
            g={geometries[i]}
            index={i}
            focused={focused}
            dimmed={!!selection && !focused}
            reducedMotion={reducedMotion}
            onPress={() =>
              onSelect(
                focused && selection?.type === "thread"
                  ? null
                  : { type: "thread", threadId: th.id },
              )
            }
          />
        );
      })}

      {/* pass two — markers, endpoints and labels drawn above every line */}
      {share.threads.map((th, i) => {
        const g = geometries[i];
        const focused = selection?.threadId === th.id;
        return (
          <ThreadMarkers
            key={th.id}
            share={share}
            threadIndex={i}
            g={g}
            mainY={mainY}
            focused={focused}
            dimmed={!!selection && !focused}
            reducedMotion={reducedMotion}
            selection={selection}
            setSelection={onSelect}
            selectBoundary={selectBoundary}
          />
        );
      })}

      {/* the end of the shared window, marked like Now */}
      <Circle cx={scale.right} cy={mainY} r={7} fill={tk.accent} />
      <SvgText
        x={scale.right}
        y={mainY - 14}
        fontSize={13}
        fontWeight="600"
        fontFamily={tk.fontBody}
        fill={tk.accent}
        textAnchor="end"
      >
        {fmtDay(share.to)}
      </SvgText>
    </Svg>
  );

  return (
    <View onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      {containerW > 0 &&
        (containerW < MIN_WIDTH ? (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            {chart}
          </ScrollView>
        ) : (
          chart
        ))}
      {/* Hint text now rendered by the parent Disclosure wrapper */}
    </View>
  );
}

/** Pass two — one thread's markers, endpoints and label, above every line. */
function ThreadMarkers({
  share,
  threadIndex,
  g,
  mainY,
  focused,
  dimmed,
  reducedMotion,
  selection,
  setSelection,
  selectBoundary,
}: {
  share: ShareExport;
  threadIndex: number;
  g: ThreadGeometry;
  mainY: number;
  focused: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  selectBoundary: (threadId: string, kind: "started" | "integrated") => void;
}) {
  const tk = useTheme();
  const th = share.threads[threadIndex];
  // Markers arrive as their line finishes drawing itself in.
  const groupProps = useDimProps(dimmed, reducedMotion ? 0 : 90 * threadIndex + 550);

  return (
    <AnimatedG animatedProps={groupProps}>
      {/* moments and steps along the line */}
      {g.eventPoints.map((p) => {
        const isSel =
          selection?.type === "event" &&
          selection.threadId === th.id &&
          (selection.index === p.index ||
            (p.clusterIndexes?.includes(selection.index) ?? false));
        if (p.clusterSize) {
          // Several same-day events folded into one counted point.
          return (
            <G key={p.index}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={isSel ? 8 : 7}
                fill={g.color}
                stroke={tk.bg}
                strokeWidth={1.5}
                onPress={() =>
                  setSelection(
                    isSel ? null : { type: "event", threadId: th.id, index: p.index },
                  )
                }
              />
              <SvgText
                x={p.x}
                y={p.y + 3}
                fontSize={9}
                fontWeight="700"
                fontFamily={tk.fontBody}
                fill={tk.bg}
                textAnchor="middle"
                pointerEvents="none"
              >
                {p.clusterSize}
              </SvgText>
            </G>
          );
        }
        return (
          <Circle
            key={p.index}
            cx={p.x}
            cy={p.y}
            r={isSel ? 6 : 4.5}
            fill={g.color}
            stroke={tk.bg}
            strokeWidth={1.5}
            onPress={() =>
              setSelection(
                isSel ? null : { type: "event", threadId: th.id, index: p.index },
              )
            }
          />
        );
      })}

      {/* fork point on the main line — when the start is inside the window */}
      {g.forkVisible && (
        <Circle
          cx={g.forkX}
          cy={mainY}
          r={4}
          stroke={g.color}
          strokeWidth={2}
          fill={tk.bg}
          onPress={() => selectBoundary(th.id, "started")}
        />
      )}

      {/* an integrated line ends on the main line; an open one reaches the window end */}
      {g.endsOnMain ? (
        <Circle
          cx={g.endX}
          cy={g.endY}
          r={6}
          stroke={g.color}
          strokeWidth={2.5}
          fill={tk.bg}
          onPress={() => selectBoundary(th.id, "integrated")}
        />
      ) : (
        <Circle
          cx={g.endX - 3}
          cy={g.endY}
          r={5}
          fill={g.color}
          opacity={g.opacity}
          onPress={() => setSelection({ type: "thread", threadId: th.id })}
        />
      )}

      {/* label: a stroked twin behind the text keeps it readable over lines.
          A focused thread shows its full, untruncated title. */}
      {(g.labelVisible || focused) && (
        <>
          <SvgText
            x={g.labelX}
            y={g.labelY}
            textAnchor={g.labelAnchor}
            fontSize={12.5}
            fontWeight={focused ? "700" : "600"}
            fontFamily={tk.fontBody}
            stroke={tk.bg}
            strokeWidth={4}
            fill={tk.bg}
            pointerEvents="none"
          >
            {focused ? g.fullLabel : g.label}
          </SvgText>
          <SvgText
            x={g.labelX}
            y={g.labelY}
            textAnchor={g.labelAnchor}
            fontSize={12.5}
            fontWeight={focused ? "700" : "600"}
            fontFamily={tk.fontBody}
            fill={g.color}
            onPress={() => setSelection({ type: "thread", threadId: th.id })}
          >
            {focused ? g.fullLabel : g.label}
          </SvgText>
        </>
      )}
    </AnimatedG>
  );
}
