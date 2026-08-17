import { View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { alpha } from "@/ui/color";
import { Disclosure, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

const GLYPH_W = 56;
const GLYPH_H = 22;
const MID = GLYPH_H / 2;

function Row({ glyph, text }: { glyph: React.ReactNode; text: string }) {
  const tk = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Svg width={GLYPH_W} height={GLYPH_H}>{glyph}</Svg>
      <T style={{ flexShrink: 1, fontSize: 13.6, color: tk.inkSoft }}>{text}</T>
    </View>
  );
}

/** A small key to the timeline's language, kept behind a disclosure. */
export function TimelineLegend() {
  const tk = useTheme();
  const line = tk.mode === "dark" ? "hsl(215 32% 68%)" : "hsl(215 32% 42%)";
  const axis = alpha(tk.lineAxis, 0.9);

  return (
    <Disclosure label="How to read this">
      <View style={{ gap: 8, paddingBottom: 4 }}>
        <Row
          glyph={
            <>
              <Line x1={2} y1={18} x2={54} y2={18} stroke={axis} strokeWidth={2} />
              <Path
                d={`M 2 14 C 10 14, 12 5, 20 5 L 54 5`}
                stroke={line}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
              />
            </>
          }
          text="Louder threads sit further from the main line and draw heavier."
        />
        <Row
          glyph={
            <Path
              d={`M 2 ${MID} q 6 -4 13 0 t 13 0 t 13 0 t 13 0`}
              stroke={line}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          }
          text="A trembling line is open and loud right now."
        />
        <Row
          glyph={
            <>
              <Line x1={2} y1={MID} x2={54} y2={MID} stroke={axis} strokeWidth={2} />
              <Circle cx={16} cy={MID} r={4.5} stroke={line} strokeWidth={2} fill={tk.bg} />
            </>
          }
          text="A hollow dot on the main line is where a thread began."
        />
        <Row
          glyph={
            <>
              <Line x1={2} y1={18} x2={54} y2={18} stroke={axis} strokeWidth={2} />
              <Path
                d={`M 2 6 L 30 6 C 40 6, 40 18, 48 18`}
                stroke={line}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
              />
              <Circle cx={48} cy={18} r={5.5} stroke={line} strokeWidth={2.5} fill={tk.bg} />
            </>
          }
          text="A line curving back with a ring means the thread integrated."
        />
        <Row
          glyph={
            <>
              <Line x1={2} y1={MID} x2={54} y2={MID} stroke={line} strokeWidth={3} strokeLinecap="round" />
              <Circle cx={18} cy={MID} r={4.5} fill={line} stroke={tk.bg} strokeWidth={1.5} />
              <Circle cx={38} cy={MID} r={7} fill={line} stroke={tk.bg} strokeWidth={1.5} />
              <SvgText
                x={38}
                y={MID + 3}
                fontSize={9}
                fontWeight="700"
                fontFamily={tk.fontBody}
                fill={tk.bg}
                textAnchor="middle"
              >
                3
              </SvgText>
            </>
          }
          text="Dots are moments and steps; a numbered dot bundles a busy day."
        />
        <Row
          glyph={
            <Line
              x1={2}
              y1={MID}
              x2={54}
              y2={MID}
              stroke={line}
              strokeWidth={2.5}
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          }
          text="Dashes drift toward the window end while a thread stays open."
        />
        <T style={{ fontSize: 13.6, color: tk.inkSoft }}>
          Tap a line for the thread, a dot for what happened there.
        </T>
      </View>
    </Disclosure>
  );
}
