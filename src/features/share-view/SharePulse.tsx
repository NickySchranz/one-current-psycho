/**
 * The at-a-glance clinical summary: what is pulling hardest right now,
 * what has been integrated, what is being waited on. The therapist's
 * first question answered in one glance.
 */
import { Pressable, View } from "react-native";
import type { ShareExport } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { CalmNote, Hint, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { isClosedThread, threadColor } from "./timeline/geometry";
import { loudnessNow, loudnessTrend } from "./loudness";
import type { Selection } from "./selection";

export function SharePulse({
  share,
  onSelect,
}: {
  share: ShareExport;
  onSelect: (s: Selection) => void;
}) {
  const t = useTheme();

  const open = share.threads
    .filter((th) => !isClosedThread(th))
    .sort((a, b) => loudnessNow(b) - loudnessNow(a));
  const closed = share.threads.filter((th) => isClosedThread(th));
  const waiting = share.threads.filter((th) => th.waiting && !th.waiting.closedAt);
  const stepCount = share.threads.reduce(
    (n, th) =>
      n + th.events.filter((e) => e.kind === "action-decided" || e.kind === "action-done").length,
    0,
  );

  // Edge case: all threads integrated in this window
  if (open.length === 0 && closed.length > 0) {
    return (
      <View style={{ marginTop: 16, marginBottom: 8 }}>
        <CalmNote>
          <T>
            {closed.length === 1
              ? "The one thread in this window was integrated."
              : `All ${closed.length} threads in this window were integrated.`}
          </T>
        </CalmNote>
        {closed.map((th) => (
          <Pressable
            key={th.id}
            accessibilityRole="button"
            accessibilityLabel={`Focus ${th.title}`}
            onPress={() => onSelect({ type: "thread", threadId: th.id })}
            style={({ pressed }) => ({
              paddingVertical: 4,
              marginTop: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Hint style={{ marginBottom: 0, fontSize: 13.6 }}>
              {th.title}
              {th.integratedOn ? ` — ${fmtDay(th.integratedOn)}` : ""}
            </Hint>
          </Pressable>
        ))}
        {stepCount > 0 && (
          <Hint style={{ marginTop: 10, marginBottom: 0 }}>
            {stepCount} step{stepCount === 1 ? "" : "s"} taken
          </Hint>
        )}
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16, marginBottom: 8 }}>
      {/* loudness bars for every open thread */}
      {open.map((th) => {
        const loudness = loudnessNow(th);
        const color = threadColor(th, t.mode);
        const hot = loudness >= 4;
        const trend = loudnessTrend(th);

        return (
          <Pressable
            key={th.id}
            accessibilityRole="button"
            accessibilityLabel={`Focus ${th.title}, loudness ${loudness}`}
            onPress={() => onSelect({ type: "thread", threadId: th.id })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: hot ? 12 : 0,
              borderLeftWidth: hot ? 3 : 0,
              borderLeftColor: hot ? color : "transparent",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ width: 80, justifyContent: "center" }}>
              <View
                style={{
                  width: `${(loudness / 5) * 100}%`,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: color,
                }}
              />
            </View>
            <T
              style={{
                fontSize: 13.6,
                fontWeight: "600",
                color: t.inkSoft,
                minWidth: 36,
              }}
            >
              {loudness.toFixed(1)} {trend}
            </T>
            <T
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: hot ? "700" : "500",
              }}
            >
              {th.title}
            </T>
          </Pressable>
        );
      })}

      {/* integrated threads, quiet */}
      {closed.map((th) => (
        <Pressable
          key={th.id}
          accessibilityRole="button"
          accessibilityLabel={`Focus ${th.title}`}
          onPress={() => onSelect({ type: "thread", threadId: th.id })}
          style={({ pressed }) => ({
            paddingVertical: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Hint style={{ marginBottom: 0, fontSize: 13.6 }}>
            {th.title}
            {th.integratedOn ? ` — integrated ${fmtDay(th.integratedOn)}` : " — integrated"}
          </Hint>
        </Pressable>
      ))}

      {/* waiting callout */}
      {waiting.map((th) => (
        <Hint key={`wait-${th.id}`} style={{ marginTop: 4, marginBottom: 0, fontSize: 13.6 }}>
          {th.title} — waiting
          {th.waiting?.reviewDate ? `, review ${fmtDay(th.waiting.reviewDate)}` : ""}
        </Hint>
      ))}

      {/* summary line */}
      <Hint style={{ marginTop: 10, marginBottom: 0 }}>
        {open.length} open
        {closed.length > 0 ? `, ${closed.length} integrated` : ""}
        {stepCount > 0 ? `, ${stepCount} step${stepCount === 1 ? "" : "s"} taken` : ""}
      </Hint>
    </View>
  );
}
