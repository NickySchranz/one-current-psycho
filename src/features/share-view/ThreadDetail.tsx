/**
 * One focused thread, spread into cards that sit side by side on a wide
 * screen and stack on a phone: the thread itself, everything it holds
 * emotionally, and the full record of what happened on it. The selected
 * event opens full width underneath.
 */
import { Pressable, View } from "react-native";
import type { SharedEvent, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Button, Card, Hint, Overline, T, Tag, rowStyles } from "@/ui/primitives";
import { SpreadColumns, type SpreadCard } from "@/ui/SpreadColumns";
import { useTheme } from "@/ui/theme";
import { KIND_LABELS, kindColor } from "./kinds";
import { isClosedThread, threadColor } from "./timeline/geometry";
import { EventDetailCard } from "./timeline/EventDetailCard";
import type { Selection } from "./selection";

/** One line of the thread's record: what happened, when. */
function eventSummary(event: SharedEvent): string {
  switch (event.kind) {
    case "started":
      return "The thread began pulling";
    case "moment":
      return event.title;
    case "action-decided":
      return `Decided: ${event.title}`;
    case "action-done":
      return `Done: ${event.title}`;
    case "integrated":
      return event.result === "converted-to-project"
        ? "Became real work and left their head"
        : "Folded back into their one line";
  }
}

function Row({ label, value }: { label: string; value?: string }) {
  const t = useTheme();
  if (!value) return null;
  return (
    <T style={{ marginTop: 6, fontSize: 14.2 }}>
      <T style={{ fontSize: 14.2, color: t.inkSoft }}>{label}: </T>
      {value}
    </T>
  );
}

function TagRow({
  label,
  items,
  quality = false,
}: {
  label: string;
  items?: string[];
  quality?: boolean;
}) {
  const t = useTheme();
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <T style={{ fontSize: 13.6, color: t.inkSoft }}>{label}</T>
      <View style={[rowStyles.tagRow, { marginBottom: 0 }]}>
        {items.map((item) => (
          <Tag key={item} quality={quality} label={item} />
        ))}
      </View>
    </View>
  );
}

export function ThreadDetail({
  thread,
  eventIndex,
  onSelect,
}: {
  thread: SharedThread;
  /** The event held open, if a dot or a record line was tapped. */
  eventIndex: number | null;
  onSelect: (s: Selection | null) => void;
}) {
  const t = useTheme();
  const color = threadColor(thread, t.mode);
  const closed = isClosedThread(thread);
  const w = thread.waiting;
  const event = eventIndex != null ? thread.events[eventIndex] : undefined;

  const holdsAnything =
    (thread.feelings?.length ?? 0) > 0 ||
    (thread.anxieties?.length ?? 0) > 0 ||
    (thread.needs?.length ?? 0) > 0 ||
    (thread.qualitiesReclaimed?.length ?? 0) > 0 ||
    !!w;

  const tagSections = [
    thread.feelings,
    thread.anxieties,
    thread.needs,
    thread.qualitiesReclaimed,
  ].filter((items) => (items?.length ?? 0) > 0).length;
  const infoRows = [
    thread.description,
    thread.startedOn,
    thread.integratedOn,
    thread.controllability,
    thread.originalBelief,
    thread.currentBelief,
  ].filter(Boolean).length;

  const cards: SpreadCard[] = [
    {
      key: "thread",
      weight: 4 + infoRows,
      node: (
        <Card style={{ marginBottom: 0 }}>
          <Overline>The thread</Overline>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
            />
            <T style={{ fontWeight: "600", flexShrink: 1 }}>{thread.title}</T>
          </View>
          <Hint style={{ marginTop: 4, marginBottom: 0 }}>
            {thread.kind}
            {thread.orientation && thread.orientation !== thread.kind
              ? ` · points at the ${thread.orientation}`
              : ""}
            {` · ${thread.status}`}
            {(thread.returnedCount ?? 0) > 0
              ? ` · returned ${thread.returnedCount === 1 ? "once" : `${thread.returnedCount} times`}`
              : ""}
          </Hint>
          {thread.description ? (
            <Hint style={{ marginTop: 6, marginBottom: 0 }}>{thread.description}</Hint>
          ) : null}
          <Row
            label="Began"
            value={
              thread.startedLabel
                ? `${thread.startedLabel} (${fmtDay(thread.startedOn)})`
                : fmtDay(thread.startedOn)
            }
          />
          {thread.integratedOn ? (
            <Row label="Integrated" value={fmtDay(thread.integratedOn)} />
          ) : null}
          <Row label="Controllability" value={thread.controllability} />
          <Row label="Original belief" value={thread.originalBelief} />
          <Row label="Belief now" value={thread.currentBelief} />
        </Card>
      ),
    },
  ];

  // everything it holds emotionally
  if (holdsAnything) {
    cards.push({
      key: "holds",
      weight: 2 + tagSections * 2 + (w ? 6 : 0),
      node: (
        <Card style={{ marginBottom: 0 }}>
          <Overline>What it holds</Overline>
            <TagRow
              label={closed ? "Feelings it held while open" : "Feelings it holds"}
              items={thread.feelings}
              quality
            />
            <TagRow label="What it makes them feel" items={thread.anxieties} />
            <TagRow label="Needs underneath" items={thread.needs} />
            <TagRow
              label={closed ? "Qualities reclaimed" : "Qualities stored inside it"}
              items={thread.qualitiesReclaimed}
              quality
            />
            {w ? (
              <View
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: t.lineAxis,
                }}
              >
                <T style={{ fontWeight: "600", fontSize: 14.7 }}>
                  Waiting{w.closedAt ? ` — closed ${fmtDay(w.closedAt)}` : ""}
                </T>
                <Row label="Awaiting" value={w.awaiting} />
                <Row label="Action already taken" value={w.actionTaken} />
                {w.reviewDate ? (
                  <Row label="Next review" value={fmtDay(w.reviewDate)} />
                ) : null}
                <TagRow label="Outside their control" items={w.outsideControl} />
                <TagRow label="Would reopen it earlier" items={w.reopenConditions} />
                <TagRow label="Living on meanwhile" items={w.continueMeanwhile} />
                <TagRow label="Reclaimed already" items={w.reclaimedNow} quality />
              </View>
            ) : null}
        </Card>
      ),
    });
  }

  // the full record inside the shared window
  cards.push({
    key: "record",
    weight: 3 + Math.max(1, thread.events.length) * 2,
    node: (
        <Card style={{ marginBottom: 0 }}>
          <Overline>What happened</Overline>
          {thread.events.length === 0 && (
            <Hint style={{ marginBottom: 0 }}>
              Nothing was recorded on this thread inside the window.
            </Hint>
          )}
          {thread.events.map((e, index) => {
            const selected = index === eventIndex;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`${KIND_LABELS[e.kind]} on ${fmtDay(e.on)}`}
                onPress={() =>
                  onSelect(
                    selected
                      ? { type: "thread", threadId: thread.id }
                      : { type: "event", threadId: thread.id, index },
                  )
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  marginTop: index === 0 ? 2 : 7,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 5,
                    backgroundColor: kindColor(e.kind, t),
                  }}
                />
                <View style={{ flex: 1 }}>
                  <T
                    style={{
                      fontSize: 14.2,
                      fontWeight: selected ? "700" : "400",
                    }}
                  >
                    {eventSummary(e)}
                  </T>
                  <Hint style={{ marginTop: 1, marginBottom: 0, fontSize: 12.8 }}>
                    {fmtDay(e.on)} · {KIND_LABELS[e.kind]}
                    {e.kind === "moment" && e.impact != null
                      ? ` · felt impact ${e.impact}/5`
                      : ""}
                    {e.kind === "action-decided" && e.durationMinutes
                      ? ` · about ${e.durationMinutes} min`
                      : ""}
                  </Hint>
                </View>
              </Pressable>
            );
          })}
          {thread.events.length > 0 && (
            <Hint style={{ marginTop: 8, marginBottom: 0, fontSize: 12.8 }}>
              Tap a line for its full detail.
            </Hint>
          )}
        </Card>
    ),
  });

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 12, marginLeft: -12 }}>
        <Button
          label="← All shared threads"
          variant="quiet"
          onPress={() => onSelect(null)}
        />
      </View>

      <SpreadColumns cards={cards} />

      {/* the selected event, spelled out full width */}
      {event ? (
        <EventDetailCard thread={thread} event={event} style={{ marginTop: 12, marginBottom: 0 }} />
      ) : null}
    </View>
  );
}
