/**
 * One thread's full story, rendered as a vertical stack inside the thread
 * list. No separate navigation — the detail expands inline below its row.
 * Sections are separated by thin dividers: identity, beliefs, emotions,
 * what happened (with inline event detail), and waiting container.
 */
import { Pressable, View } from "react-native";
import type { SharedEvent, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Button, Hint, T, Tag, rowStyles } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { KIND_LABELS, kindColor } from "./kinds";
import { isClosedThread, threadColor } from "./timeline/geometry";
import { EventDetailCard } from "./timeline/EventDetailCard";
import type { Selection } from "./selection";

/* ---------- small helpers ---------- */

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

function Divider() {
  const t = useTheme();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: t.lineAxis,
        marginTop: 16,
        marginBottom: 16,
      }}
    />
  );
}

/** Builds a natural-language sentence from the thread's emotional landscape. */
function EmotionalSummary({
  thread,
  closed,
}: {
  thread: SharedThread;
  closed: boolean;
}) {
  const parts: string[] = [];
  if (thread.feelings && thread.feelings.length > 0) {
    parts.push(
      `${closed ? "held" : "holds"} ${thread.feelings.join(" and ")}`,
    );
  }
  if (thread.anxieties && thread.anxieties.length > 0) {
    parts.push(`makes them feel ${thread.anxieties.join(" and ")}`);
  }
  if (thread.needs && thread.needs.length > 0) {
    parts.push(
      `${thread.needs.length === 1 ? "need" : "needs"}: ${thread.needs.join(", ")}`,
    );
  }
  if (parts.length === 0) return null;
  const sentence = `This thread ${parts.join(", ")}.`;
  return (
    <Hint style={{ marginBottom: 4, fontStyle: "italic" }}>
      {sentence}
    </Hint>
  );
}

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

/* ---------- main component ---------- */

export function ThreadDetail({
  thread,
  eventIndex,
  onSelect,
}: {
  thread: SharedThread;
  eventIndex: number | null;
  onSelect: (s: Selection | null) => void;
}) {
  const t = useTheme();
  const color = threadColor(thread, t.mode);
  const closed = isClosedThread(thread);
  const w = thread.waiting;
  const event = eventIndex != null ? thread.events[eventIndex] : undefined;

  const hasEmotions =
    (thread.feelings?.length ?? 0) > 0 ||
    (thread.anxieties?.length ?? 0) > 0 ||
    (thread.needs?.length ?? 0) > 0 ||
    (thread.qualitiesReclaimed?.length ?? 0) > 0;

  const hasBeliefs = !!thread.originalBelief || !!thread.currentBelief;

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 16,
        marginLeft: 20,
        borderLeftWidth: 2,
        borderLeftColor: color,
      }}
    >
      {/* ── Section A: Identity ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <T style={{ fontWeight: "600", flexShrink: 1 }}>{thread.title}</T>
      </View>

      {thread.description ? (
        <Hint style={{ marginTop: 2, marginBottom: 0 }}>{thread.description}</Hint>
      ) : null}

      <Hint style={{ marginTop: 4, marginBottom: 0, fontSize: 13.2 }}>
        {thread.kind}
        {thread.orientation && thread.orientation !== thread.kind
          ? ` · points at the ${thread.orientation}`
          : ""}
        {` · ${thread.status}`}
        {thread.controllability ? ` · ${thread.controllability}` : ""}
        {(thread.returnedCount ?? 0) > 0
          ? ` · returned ${thread.returnedCount === 1 ? "once" : `${thread.returnedCount} times`}`
          : ""}
      </Hint>

      <Row
        label="Began"
        value={
          thread.startedLabel
            ? `${thread.startedLabel} (${fmtDay(thread.startedOn)})`
            : fmtDay(thread.startedOn)
        }
      />
      {thread.integratedOn ? <Row label="Integrated" value={fmtDay(thread.integratedOn)} /> : null}

      {/* ── Section B: Belief shift ── */}
      {hasBeliefs && (
        <>
          <Divider />
          {thread.originalBelief && (
            <T style={{ fontSize: 14.7, color: t.inkSoft, fontStyle: "italic" }}>
              "{thread.originalBelief}"
            </T>
          )}
          {thread.originalBelief && thread.currentBelief && (
            <T
              style={{
                fontSize: 14,
                color: t.inkFaint,
                textAlign: "center",
                marginVertical: 6,
              }}
            >
              ↓
            </T>
          )}
          {thread.currentBelief && (
            <T style={{ fontSize: 14.7, fontWeight: "600", fontStyle: "italic" }}>
              "{thread.currentBelief}"
            </T>
          )}
        </>
      )}

      {/* ── Section C: What it holds ── */}
      {hasEmotions && (
        <>
          <Divider />
          <EmotionalSummary thread={thread} closed={closed} />
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
        </>
      )}

      {/* ── Section D: What happened ── */}
      {thread.events.length > 0 && (
        <>
          <Divider />
          <T style={{ fontSize: 13.6, color: t.inkSoft, marginBottom: 6 }}>What happened</T>
          {thread.events.map((e, index) => {
            const selected = index === eventIndex;
            const isLast = index === thread.events.length - 1;

            // Step pairing: if action-done matches a preceding action-decided title
            const paired =
              e.kind === "action-done" &&
              thread.events.some(
                (prev, pi) =>
                  pi < index && prev.kind === "action-decided" && prev.title === e.title,
              );

            return (
              <View key={index}>
                <Pressable
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
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  {/* dot with connecting line to next event */}
                  <View style={{ alignItems: "center", width: 8 }}>
                    {/* connecting line from previous dot */}
                    {index > 0 && (
                      <View
                        style={{
                          width: 1,
                          height: 6,
                          backgroundColor: t.lineAxis,
                        }}
                      />
                    )}
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: kindColor(e.kind, t),
                      }}
                    />
                    {/* connecting line to next dot */}
                    {!isLast && (
                      <View
                        style={{
                          width: 1,
                          flex: 1,
                          minHeight: 8,
                          backgroundColor: t.lineAxis,
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: isLast ? 0 : 6 }}>
                    <T
                      style={{
                        fontSize: 14.2,
                        fontWeight: selected ? "700" : "400",
                      }}
                    >
                      {paired ? `${e.title} ✓` : eventSummary(e)}
                    </T>
                    <Hint style={{ marginTop: 1, marginBottom: 0, fontSize: 12.8 }}>
                      {fmtDay(e.on)}
                      {paired
                        ? " · step completed"
                        : ` · ${KIND_LABELS[e.kind]}`}
                      {e.kind === "moment" && e.impact != null
                        ? ` · felt impact ${e.impact}/5`
                        : ""}
                      {e.kind === "action-decided" && e.durationMinutes
                        ? ` · about ${e.durationMinutes} min`
                        : ""}
                    </Hint>
                  </View>
                </Pressable>
                {/* inline event detail directly below the tapped event */}
                {selected && event && (
                  <EventDetailCard
                    thread={thread}
                    event={event}
                    style={{ marginTop: 8, marginBottom: 4, marginLeft: 16 }}
                  />
                )}
              </View>
            );
          })}
        </>
      )}

      {/* ── Section E: Waiting ── */}
      {w && (
        <>
          <Divider />
          <T style={{ fontWeight: "600", fontSize: 14.7 }}>
            Waiting{w.closedAt ? ` — closed ${fmtDay(w.closedAt)}` : ""}
          </T>
          <Row label="Awaiting" value={w.awaiting} />
          <Row label="Action already taken" value={w.actionTaken} />
          {w.reviewDate ? <Row label="Next review" value={fmtDay(w.reviewDate)} /> : null}
          <TagRow label="Outside their control" items={w.outsideControl} />
          <TagRow label="Would reopen it earlier" items={w.reopenConditions} />
          <TagRow label="Living on meanwhile" items={w.continueMeanwhile} />
          <TagRow label="Reclaimed already" items={w.reclaimedNow} quality />
        </>
      )}

      {/* collapse button */}
      <View style={{ marginTop: 16 }}>
        <Button
          variant="quiet"
          label="Collapse"
          onPress={() => onSelect(null)}
          style={{ alignSelf: "flex-start" }}
        />
      </View>
    </View>
  );
}
