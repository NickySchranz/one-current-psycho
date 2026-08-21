import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import type { SharedSpring, WellspringShare } from "@/domain/share-types";
import { useTheme } from "@/ui/theme";
import { alpha, mix } from "@/ui/color";
import { Button, Card, CalmNote, Disclosure, Hint, Overline, Panel, T, Tag, rowStyles } from "@/ui/primitives";
import { useAppStore } from "@/stores/app-store";

const STRENGTH_WORDS = ["a whisper", "quiet", "steady", "strong", "leading"];
const word = (v: number) => STRENGTH_WORDS[Math.max(1, Math.min(5, Math.round(v))) - 1];

const SPRING_HEX: Record<string, [string, string]> = {
  gold: ["#b8863f", "#d8a35b"],
  teal: ["#2e7d84", "#58b5a4"],
  green: ["#4a7c46", "#79b072"],
  plum: ["#7d5a86", "#a985b3"],
  rust: ["#a2574f", "#c98077"],
  slate: ["#5a6b7d", "#8ba0b3"],
};

function springHex(color: string, mode: "light" | "dark"): string {
  const pair = SPRING_HEX[color] ?? SPRING_HEX.slate!;
  return mode === "dark" ? pair[1] : pair[0];
}

const fmtDay = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

/** Last 14 days of a spring's strength, as a small line. */
function StrengthSparkline({ spring, share, color }: {
  spring: SharedSpring;
  share: WellspringShare;
  color: string;
}) {
  const t = useTheme();
  const W = 220;
  const H = 44;
  const days = useMemo(() => {
    const out: { date: string; value: number | null }[] = [];
    const end = new Date(`${share.to.slice(0, 10)}T12:00:00`);
    let last: number | null = null;
    for (let i = 13; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const reading = share.strengths.find((s) => s.springId === spring.id && s.date === iso);
      if (reading) last = reading.value;
      out.push({ date: iso, value: reading ? reading.value : last });
    }
    return out;
  }, [share, spring.id]);

  const pts = days
    .map((d, i) => ({ i, v: d.value }))
    .filter((p): p is { i: number; v: number } => p.v != null);
  if (pts.length === 0) return <Hint>No readings in this window.</Hint>;
  const x = (i: number) => 6 + (i / 13) * (W - 12);
  const y = (v: number) => H - 6 - ((v - 1) / 4) * (H - 14);
  const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${x(p.i)} ${y(p.v)}`).join(" ");
  const lastPt = pts[pts.length - 1]!;

  return (
    <Svg width={W} height={H}>
      {[1, 3, 5].map((v) => (
        <Path key={v} d={`M 6 ${y(v)} H ${W - 6}`} stroke={alpha(t.lineAxis, 0.7)} strokeWidth={0.7} />
      ))}
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx={x(lastPt.i)} cy={y(lastPt.v)} r={3.4} fill={color} />
      <SvgText x={W - 6} y={y(lastPt.v) - 6} fontSize={9.5} fill={t.inkSoft} textAnchor="end">
        {word(lastPt.v)}
      </SvgText>
    </Svg>
  );
}

/** The whole Wellspring document, rendered in this app's manners. */
export function WellspringView({ data }: { data: WellspringShare }) {
  const t = useTheme();
  const [openSpring, setOpenSpring] = useState<string | null>(null);
  const active = data.springs.filter((s) => !s.retiredAt);
  const retired = data.springs.filter((s) => s.retiredAt);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof data.moments>();
    for (const mo of data.moments) {
      const day = mo.at.slice(0, 10);
      m.set(day, [...(m.get(day) ?? []), mo]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data.moments]);
  const bridged = data.moments.filter((m) => m.source === "one-current").length;

  return (
    <Panel wide>
      <Overline>Wellspring — living values</Overline>
      <Hint style={{ marginBottom: 10 }}>
        {fmtDay(data.from)} → {fmtDay(data.to)} · {data.moments.length}{" "}
        {data.moments.length === 1 ? "moment" : "moments"}
        {bridged > 0 ? ` · ${bridged} fed by handled worries ⇄` : ""}
      </Hint>

      {/* the week's weather */}
      {data.days.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <Overline>How the days flowed</Overline>
          <View style={[rowStyles.tagRow, { marginTop: 8 }]}>
            {data.days.slice(-14).map((d) => (
              <View key={d.date} style={{ alignItems: "center", minWidth: 44 }}>
                <T style={{ fontSize: 10.5, color: t.inkFaint }}>{fmtDay(d.date)}</T>
                <T
                  style={{
                    fontSize: 11.5,
                    fontWeight: "600",
                    color: mix(t.accent, t.ink, 100 - Math.min(100, d.flowScore)),
                  }}
                >
                  {d.flowWord}
                </T>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* springs */}
      <Overline>Springs</Overline>
      {active.map((sp) => {
        const color = springHex(sp.color, t.mode);
        const momentCount = data.moments.filter((m) => m.springId === sp.id).length;
        const open = openSpring === sp.id;
        return (
          <Card key={sp.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color }} />
              <T style={{ fontWeight: "700", fontSize: 15 }}>{sp.name}</T>
              <View style={{ flex: 1 }} />
              <Button
                variant="quiet"
                label={open ? "Less" : "More"}
                onPress={() => setOpenSpring(open ? null : sp.id)}
              />
            </View>
            <T style={{ fontStyle: "italic", color: t.inkSoft, fontSize: 13, marginTop: 2 }}>
              “{sp.identity}”
            </T>
            <View style={{ marginTop: 8 }}>
              <StrengthSparkline spring={sp} share={data} color={color} />
            </View>
            {open && (
              <View style={{ marginTop: 8 }}>
                <Hint>
                  {momentCount} {momentCount === 1 ? "moment" : "moments"} of evidence in this window
                </Hint>
                {data.moments
                  .filter((m) => m.springId === sp.id)
                  .slice(0, 8)
                  .map((m) => (
                    <T key={m.id} style={{ fontSize: 13, color: t.inkSoft, marginTop: 4 }}>
                      <T style={{ color }}>● </T>
                      {m.text}
                      {m.source === "one-current" ? "  ⇄" : ""}
                    </T>
                  ))}
              </View>
            )}
          </Card>
        );
      })}
      {retired.length > 0 && (
        <Disclosure label={`Earlier eras (${retired.length})`}>
          {retired.map((sp) => (
            <View key={sp.id} style={{ marginBottom: 6 }}>
              <T style={{ fontWeight: "600" }}>{sp.name}</T>
              <Hint>{sp.eraLabel ?? "retired with honor"}</Hint>
            </View>
          ))}
        </Disclosure>
      )}

      {/* mornings */}
      {data.intentions.length > 0 && (
        <Disclosure label={`Morning intentions (${data.intentions.length})`}>
          {data.intentions
            .slice()
            .sort((a, b) => b.id.localeCompare(a.id))
            .slice(0, 14)
            .map((i) => (
              <View key={i.id} style={{ marginBottom: 8 }}>
                <T style={{ fontWeight: "600", fontSize: 13 }}>{fmtDay(i.id)}</T>
                <View style={[rowStyles.tagRow, { marginTop: 2 }]}>
                  {i.springIds.map((sid) => {
                    const sp = data.springs.find((s) => s.id === sid);
                    return sp ? <Tag key={sid} label={sp.name} /> : null;
                  })}
                </View>
                {i.note ? <Hint>{i.note}</Hint> : null}
              </View>
            ))}
        </Disclosure>
      )}

      {/* day by day */}
      <Disclosure label={`Moments, day by day (${data.moments.length})`}>
        {byDay.slice(0, 21).map(([day, moments]) => (
          <View key={day} style={{ marginBottom: 10 }}>
            <T style={{ fontWeight: "700", fontSize: 13 }}>{fmtDay(day)}</T>
            {moments.map((m) => {
              const sp = data.springs.find((s) => s.id === m.springId);
              return (
                <T key={m.id} style={{ fontSize: 13, color: t.inkSoft, marginTop: 3 }}>
                  <T style={{ color: sp ? springHex(sp.color, t.mode) : t.inkSoft }}>● </T>
                  {m.text}
                  {sp ? `  — ${sp.name}` : ""}
                  {m.source === "one-current" ? "  ⇄ handled in One Current" : ""}
                </T>
              );
            })}
          </View>
        ))}
      </Disclosure>

      <CalmNote>
        Springs are values this person is watering — evidence, not scores. A ⇄ mark means a worry
        handled in One Current fed the spring.
      </CalmNote>
    </Panel>
  );
}

/** Route wrapper so ShareScreen can hand any share here. */
export function WellspringShareScreen({ clientId, shareId }: { clientId: string; shareId: string }) {
  const share = useAppStore((s) => s.shares.find((sh) => sh.id === shareId));
  const setView = useAppStore((s) => s.setView);
  if (!share || !("springs" in share.data)) {
    return (
      <ScrollView style={{ flex: 1 }}>
        <Panel>
          <Hint>This shared file no longer exists.</Hint>
          <Button label="Back" onPress={() => setView({ kind: "client", clientId })} />
        </Panel>
      </ScrollView>
    );
  }
  return (
    <ScrollView style={{ flex: 1 }}>
      <WellspringView data={share.data} />
    </ScrollView>
  );
}
