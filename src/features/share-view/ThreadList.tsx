/**
 * Every shared thread as a sorted, scannable list. Open threads sorted by
 * loudness (loudest first), then integrated threads. Tapping a row expands
 * its full detail inline — no navigation, no separate view.
 */
import { Pressable, View } from "react-native";
import type { ShareExport, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Hint, Overline, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { isClosedThread, threadColor } from "./timeline/geometry";
import { loudnessNow, loudnessTrend } from "./loudness";
import { ThreadDetail } from "./ThreadDetail";
import type { Selection } from "./selection";

function ThreadRow({
  thread,
  focused,
  onPress,
}: {
  thread: SharedThread;
  focused: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const color = threadColor(thread, t.mode);
  const closed = isClosedThread(thread);
  const loudness = loudnessNow(thread);
  const hot = loudness >= 4;
  const quiet = loudness < 2;
  const eventCount = thread.events.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${focused ? "Collapse" : "Expand"} ${thread.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderLeftWidth: hot && !closed ? 3 : 0,
        borderLeftColor: hot && !closed ? color : "transparent",
        backgroundColor: focused ? t.bgSunken : "transparent",
        borderRadius: focused ? t.radius : 0,
        opacity: pressed && !focused ? 0.6 : closed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          marginTop: 4,
          backgroundColor: color,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T
          numberOfLines={1}
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: quiet && !closed ? t.inkSoft : t.ink,
          }}
        >
          {thread.title}
        </T>
        <Hint style={{ marginTop: 1, marginBottom: 0, fontSize: 12.8 }}>
          {thread.kind} · {thread.status}
          {closed && thread.integratedOn ? ` · integrated ${fmtDay(thread.integratedOn)}` : ""}
          {eventCount > 0 ? ` · ${eventCount} event${eventCount === 1 ? "" : "s"}` : ""}
        </Hint>
      </View>
      {!closed && (
        <View style={{ alignItems: "flex-end", gap: 2, paddingTop: 2 }}>
          <View style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: t.bgSunken }}>
            <View
              style={{
                width: `${(loudness / 5) * 100}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          </View>
          <T style={{ fontSize: 11, color: t.inkFaint }}>
            {loudness.toFixed(1)} {loudnessTrend(thread)}
          </T>
        </View>
      )}
    </Pressable>
  );
}

export function ThreadList({
  share,
  selection,
  onSelect,
}: {
  share: ShareExport;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const open = share.threads
    .filter((th) => !isClosedThread(th))
    .sort((a, b) => loudnessNow(b) - loudnessNow(a));
  const closed = share.threads.filter((th) => isClosedThread(th));

  return (
    <View style={{ marginTop: 8 }}>
      <Overline>Threads</Overline>

      {open.map((th) => {
        const focused = selection?.threadId === th.id;
        return (
          <View key={th.id}>
            <ThreadRow
              thread={th}
              focused={focused}
              onPress={() => onSelect(focused ? null : { type: "thread", threadId: th.id })}
            />
            {focused && (
              <ThreadDetail
                thread={th}
                eventIndex={selection?.type === "event" ? selection.index : null}
                onSelect={onSelect}
              />
            )}
          </View>
        );
      })}

      {closed.length > 0 && open.length > 0 && (
        <Hint style={{ marginTop: 14, marginBottom: 6, fontSize: 12.8 }}>
          Integrated inside this window
        </Hint>
      )}

      {closed.map((th) => {
        const focused = selection?.threadId === th.id;
        return (
          <View key={th.id}>
            <ThreadRow
              thread={th}
              focused={focused}
              onPress={() => onSelect(focused ? null : { type: "thread", threadId: th.id })}
            />
            {focused && (
              <ThreadDetail
                thread={th}
                eventIndex={selection?.type === "event" ? selection.index : null}
                onSelect={onSelect}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
