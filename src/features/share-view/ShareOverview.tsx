/**
 * The whole share at a glance, spread into cards that sit side by side on
 * a wide screen and stack on a phone: every shared thread, the emotions
 * moving through the window, and the steps the client decided and took.
 * Everything tappable focuses the timeline above.
 */
import { Pressable, View } from "react-native";
import type { ShareExport, SharedEvent, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Card, Hint, T, Tag, rowStyles } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { KIND_LABELS, kindColor } from "./kinds";
import { isClosedThread, threadColor } from "./timeline/geometry";
import type { Selection } from "./selection";

export const spreadRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 10,
  alignItems: "flex-start" as const,
};
export const spreadCell = { flexGrow: 1, flexBasis: 300, marginBottom: 0 };

/** The uppercase overline a spread card opens with. */
export function Overline({ children }: { children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <T
      style={{
        fontSize: 12.5,
        fontWeight: "600",
        letterSpacing: 0.75,
        textTransform: "uppercase",
        color: t.inkSoft,
        marginBottom: 6,
      }}
    >
      {children}
    </T>
  );
}

function loudnessNow(th: SharedThread): number {
  return th.loudness.length > 0 ? th.loudness[th.loudness.length - 1].loudness : 2;
}

/** One tappable thread row — the same dot and colour as its line above. */
function ThreadRow({
  thread,
  onPress,
}: {
  thread: SharedThread;
  onPress: () => void;
}) {
  const t = useTheme();
  const color = threadColor(thread, t.mode);
  const closed = isClosedThread(thread);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Focus ${thread.title} on the timeline`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        marginTop: 8,
        opacity: pressed ? 0.6 : 1,
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
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 14.7, fontWeight: "600" }}>{thread.title}</T>
        <Hint style={{ marginTop: 1, marginBottom: 0, fontSize: 12.8 }}>
          {thread.kind} · {thread.status}
          {closed && thread.integratedOn
            ? ` · integrated ${fmtDay(thread.integratedOn)}`
            : ` · loudness now ${loudnessNow(thread)}`}
        </Hint>
      </View>
    </Pressable>
  );
}

type Step = { thread: SharedThread; event: SharedEvent; index: number };

export function ShareOverview({
  share,
  onSelect,
}: {
  share: ShareExport;
  onSelect: (s: Selection) => void;
}) {
  const t = useTheme();

  const open = share.threads
    .filter((thr) => !isClosedThread(thr))
    .sort((a, b) => loudnessNow(b) - loudnessNow(a));
  const closed = share.threads.filter((thr) => isClosedThread(thr));

  const held = [...new Set(open.flatMap((thr) => thr.feelings ?? []))];
  const felt = [...new Set(open.flatMap((thr) => thr.anxieties ?? []))];
  const returned = [
    ...new Set(
      share.threads.flatMap((thr) => [
        ...(thr.qualitiesReclaimed ?? []),
        ...thr.events.flatMap((e) => (e.kind === "integrated" ? e.reclaimed ?? [] : [])),
        ...(thr.waiting?.reclaimedNow ?? []),
      ]),
    ),
  ];

  const steps: Step[] = share.threads
    .flatMap((thr) =>
      thr.events
        .map((event, index) => ({ thread: thr, event, index }))
        .filter(
          (s) => s.event.kind === "action-decided" || s.event.kind === "action-done",
        ),
    )
    .sort((a, b) => a.event.on.localeCompare(b.event.on));

  const hasEmotions = held.length + felt.length + returned.length > 0;

  return (
    <View style={spreadRow}>
      {/* every shared thread, loudest first, tappable */}
      <Card style={spreadCell}>
        <Overline>The threads</Overline>
        {open.map((thr) => (
          <ThreadRow
            key={thr.id}
            thread={thr}
            onPress={() => onSelect({ type: "thread", threadId: thr.id })}
          />
        ))}
        {closed.length > 0 && open.length > 0 && (
          <Hint style={{ marginTop: 10, marginBottom: 0, fontSize: 12.8 }}>
            Integrated inside this window
          </Hint>
        )}
        {closed.map((thr) => (
          <ThreadRow
            key={thr.id}
            thread={thr}
            onPress={() => onSelect({ type: "thread", threadId: thr.id })}
          />
        ))}
      </Card>

      {/* the emotional weather of the window */}
      {hasEmotions && (
        <Card style={spreadCell}>
          <Overline>Emotions in this window</Overline>
          {held.length > 0 && (
            <View>
              <T style={{ fontSize: 13.6, color: t.inkSoft }}>
                Held by the open threads
              </T>
              <View style={[rowStyles.tagRow, { marginBottom: 0 }]}>
                {held.map((f) => (
                  <Tag key={f} quality label={f} />
                ))}
              </View>
            </View>
          )}
          {felt.length > 0 && (
            <View style={{ marginTop: held.length > 0 ? 10 : 0 }}>
              <T style={{ fontSize: 13.6, color: t.inkSoft }}>
                What the threads make them feel
              </T>
              <View style={[rowStyles.tagRow, { marginBottom: 0 }]}>
                {felt.map((f) => (
                  <Tag key={f} label={f} />
                ))}
              </View>
            </View>
          )}
          {returned.length > 0 && (
            <View style={{ marginTop: held.length + felt.length > 0 ? 10 : 0 }}>
              <T style={{ fontSize: 13.6, color: t.inkSoft }}>
                Given back by integrations and steps
              </T>
              <View style={[rowStyles.tagRow, { marginBottom: 0 }]}>
                {returned.map((f) => (
                  <Tag key={f} quality label={f} />
                ))}
              </View>
            </View>
          )}
        </Card>
      )}

      {/* every step decided or done, in order, tappable */}
      <Card style={spreadCell}>
        <Overline>Steps taken</Overline>
        {steps.length === 0 && (
          <Hint style={{ marginBottom: 0 }}>
            No steps were decided inside this window.
          </Hint>
        )}
        {steps.map((s, i) => (
          <Pressable
            key={`${s.thread.id}-${s.index}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`${KIND_LABELS[s.event.kind]} on ${fmtDay(s.event.on)}`}
            onPress={() =>
              onSelect({ type: "event", threadId: s.thread.id, index: s.index })
            }
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              marginTop: i === 0 ? 2 : 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 5,
                backgroundColor: kindColor(s.event.kind, t),
              }}
            />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 14.2 }}>
                {s.event.kind === "action-decided" || s.event.kind === "action-done"
                  ? s.event.title
                  : ""}
              </T>
              <Hint style={{ marginTop: 1, marginBottom: 0, fontSize: 12.8 }}>
                {fmtDay(s.event.on)} ·{" "}
                {s.event.kind === "action-done" ? "done" : "decided"} · toward “
                {s.thread.title}”
              </Hint>
            </View>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}
