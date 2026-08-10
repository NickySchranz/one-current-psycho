import { View } from "react-native";
import type { SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Card, Hint, T, Tag, rowStyles } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { isClosedThread, threadColor } from "./geometry";

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

/** Everything the client shared about one thread, spelled out. */
export function ThreadDetailCard({ thread }: { thread: SharedThread }) {
  const t = useTheme();
  const color = threadColor(thread, t.mode);
  const closed = isClosedThread(thread);
  const w = thread.waiting;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
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
          thread.startedLabel ? `${thread.startedLabel} (${fmtDay(thread.startedOn)})` : fmtDay(thread.startedOn)
        }
      />
      {thread.integratedOn ? <Row label="Integrated" value={fmtDay(thread.integratedOn)} /> : null}
      <Row label="Controllability" value={thread.controllability} />
      <Row label="Original belief" value={thread.originalBelief} />
      <Row label="Belief now" value={thread.currentBelief} />

      <TagRow label={closed ? "Feelings it held while open" : "Feelings it holds"} items={thread.feelings} quality />
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
          {w.reviewDate ? <Row label="Next review" value={fmtDay(w.reviewDate)} /> : null}
          <TagRow label="Outside their control" items={w.outsideControl} />
          <TagRow label="Would reopen it earlier" items={w.reopenConditions} />
          <TagRow label="Living on meanwhile" items={w.continueMeanwhile} />
          <TagRow label="Reclaimed already" items={w.reclaimedNow} quality />
        </View>
      ) : null}
    </Card>
  );
}
