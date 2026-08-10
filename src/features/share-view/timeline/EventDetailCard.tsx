import { View, type StyleProp, type ViewStyle } from "react-native";
import type { SharedEvent, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { KIND_LABELS, kindColor } from "@/features/share-view/kinds";
import { Card, Hint, T, Tag, rowStyles } from "@/ui/primitives";
import { useTheme, type ThemeTokens } from "@/ui/theme";

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

function TagRow({ label, items, quality = false }: { label: string; items?: string[]; quality?: boolean }) {
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

function heading(event: SharedEvent, t: ThemeTokens): { text: string; color: string } {
  const color = kindColor(event.kind, t);
  if (event.kind === "moment") return { text: `Moment — ${event.momentType}`, color };
  return { text: KIND_LABELS[event.kind], color };
}

/** The selected timeline event, spelled out under the chart. */
export function EventDetailCard({
  thread,
  event,
  style,
}: {
  thread: SharedThread;
  event: SharedEvent;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const h = heading(event, t);

  return (
    <Card style={style}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: h.color }} />
        <T style={{ fontWeight: "600" }}>{h.text}</T>
        <T style={{ color: t.inkSoft, fontSize: 13.6 }}>{fmtDay(event.on)}</T>
      </View>
      <Hint style={{ marginTop: 4, marginBottom: 0 }}>on “{thread.title}”</Hint>

      {(event.kind === "moment" ||
        event.kind === "action-decided" ||
        event.kind === "action-done") && <T style={{ marginTop: 8 }}>{event.title}</T>}

      {event.kind === "moment" && (
        <>
          {event.description ? (
            <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.description}</Hint>
          ) : null}
          {event.impact != null ? (
            <Row label="Felt impact" value={`${event.impact} / 5`} />
          ) : null}
          <Row label="Belief it added" value={event.beliefAdded} />
          {event.effect ? (
            <Row label="It left the thread" value={event.effect} />
          ) : null}
        </>
      )}

      {event.kind === "action-decided" && (
        <>
          {event.instruction ? (
            <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.instruction}</Hint>
          ) : null}
          {event.durationMinutes != null ? (
            <Row label="Sized at" value={`about ${event.durationMinutes} min`} />
          ) : null}
          <Row label="Smallest version that counts" value={event.minimumVersion} />
          <Row label="Done means" value={event.completionDefinition} />
          <Row label="This thread appears as" value={event.representedAs} />
          <TagRow label="Qualities the step carries" items={event.qualitiesCarried} quality />
        </>
      )}

      {event.kind === "integrated" && (
        <>
          <T style={{ marginTop: 8 }}>Result: {event.result}</T>
          {event.resolution ? (
            <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.resolution}</Hint>
          ) : null}
          <Row
            label="What it now contributes"
            value={
              event.contribution
                ? event.contributionKind
                  ? `${event.contribution} (${event.contributionKind})`
                  : event.contribution
                : undefined
            }
          />
          <TagRow label="Reclaimed" items={event.reclaimed} quality />
          <TagRow label="Still valid" items={event.stillValid} />
          <TagRow label="Beliefs that aged out" items={event.outdatedBeliefs} />
          <TagRow label="Outside their control" items={event.outsideControl} />
          <TagRow label="Released" items={event.released} />
          {event.conflicts && event.conflicts.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <T style={{ fontSize: 13.6, color: t.inkSoft }}>Tensions worked through</T>
              {event.conflicts.map((c, i) => (
                <View
                  key={i}
                  style={{
                    marginTop: 6,
                    paddingLeft: 10,
                    borderLeftWidth: 2,
                    borderLeftColor: t.lineAxis,
                  }}
                >
                  <T style={{ fontSize: 14.2 }}>
                    “{c.demandA}” vs “{c.demandB}”
                  </T>
                  <Hint style={{ marginTop: 2, marginBottom: 0, fontSize: 13.4 }}>
                    {c.type}
                    {c.resolution ? ` — ${c.resolution}` : ""}
                  </Hint>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}
