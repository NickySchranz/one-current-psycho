import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
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
} from "./geometry";
import { EventDetailCard } from "./EventDetailCard";
import { ThreadDetailCard } from "./ThreadDetailCard";

const PAD_L = 12;
const PAD_R = 20;
const MIN_WIDTH = 640;

type Selection =
  | { type: "thread"; threadId: string }
  | { type: "event"; threadId: string; index: number };

/**
 * The whole share as one summarized timeline, drawn the way the client's
 * own app draws their life: a main line with each shared thread forking
 * away, pulled further out the louder it felt, curving back when it
 * integrated. Tap a line or a marker for the full detail.
 */
export function ShareTimeline({ share }: { share: ShareExport }) {
  const tk = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const width = Math.max(containerW, MIN_WIDTH);
  const compact = width < 760;
  const laneGap = compact ? LANE_GAP_COMPACT : LANE_GAP;
  const curveLength = compact ? CURVE_LENGTH_COMPACT : CURVE_LENGTH;

  const { scale, geometries, mainY, height } = useMemo(() => {
    const scale = makeDateScale(share.from, share.to, PAD_L, width - PAD_R);
    const lanes = assignLanes(share.threads, share.to);
    const { above, below } = laneExtents(lanes);
    const mainY = TOP_PAD + above * laneGap;
    const height = TOP_PAD + (above + below) * laneGap + BOTTOM_PAD + AXIS_H;
    const metrics = { mainY, laneGap, curveLength, mode: tk.mode };
    const geometries = share.threads.map((th) => {
      const lane = lanes.find((l) => l.threadId === th.id)?.lane ?? 1;
      return buildThreadGeometry(th, lane, scale, metrics, share.from, share.to);
    });
    return { scale, geometries, mainY, height };
  }, [share, width, laneGap, curveLength, tk.mode]);

  if (share.threads.length === 0) {
    return <Hint>This share holds no threads.</Hint>;
  }

  const selectedThread = selection
    ? share.threads.find((th) => th.id === selection.threadId)
    : undefined;
  const selectedEvent =
    selection?.type === "event" && selectedThread
      ? selectedThread.events[selection.index]
      : undefined;

  /** Fork/merge points select their started/integrated event when shared. */
  const selectBoundary = (threadId: string, kind: "started" | "integrated") => {
    const thread = share.threads.find((th) => th.id === threadId);
    const index = thread?.events.findIndex((e) => e.kind === kind) ?? -1;
    setSelection(
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

      {/* the main line: the client's one current */}
      <Line
        x1={0}
        y1={mainY}
        x2={width}
        y2={mainY}
        stroke={tk.lineMain}
        strokeWidth={3.25}
        strokeLinecap="round"
      />

      {/* pass one — every line and its hit area, so no line ever covers
          another thread's markers */}
      {share.threads.map((th, i) => {
        const g = geometries[i];
        const focused = selection?.threadId === th.id;
        return (
          <G key={th.id} opacity={selection && !focused ? 0.35 : 1}>
            {/* generous invisible hit area */}
            <Path
              d={g.path}
              stroke="transparent"
              strokeWidth={22}
              fill="none"
              onPress={() =>
                setSelection(
                  focused && selection?.type === "thread"
                    ? null
                    : { type: "thread", threadId: th.id },
                )
              }
            />
            <Path
              d={g.path}
              stroke={g.color}
              strokeWidth={focused ? g.thickness + 1.25 : g.thickness}
              opacity={g.opacity}
              fill="none"
              strokeLinecap="round"
              pointerEvents="none"
            />
          </G>
        );
      })}

      {/* pass two — markers, endpoints and labels drawn above every line */}
      {share.threads.map((th, i) => {
        const g = geometries[i];
        const focused = selection?.threadId === th.id;
        return (
          <G key={th.id} opacity={selection && !focused ? 0.35 : 1}>
            {/* moments and steps along the line */}
            {g.eventPoints.map((p) => {
              const isSel =
                selection?.type === "event" &&
                selection.threadId === th.id &&
                selection.index === p.index;
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

            {/* label: a stroked twin behind the text keeps it readable over lines */}
            {g.labelVisible && (
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
                  {g.label}
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
                  {g.label}
                </SvgText>
              </>
            )}
          </G>
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
      <Hint style={{ marginTop: 4 }}>
        Louder threads sit further from the main line and draw heavier. Tap a line for the
        thread, a dot for what happened there.
      </Hint>
      {selectedThread && selectedEvent ? (
        <EventDetailCard thread={selectedThread} event={selectedEvent} />
      ) : selectedThread ? (
        <ThreadDetailCard thread={selectedThread} />
      ) : null}
    </View>
  );
}
