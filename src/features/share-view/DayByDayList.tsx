import { useMemo } from "react";
import { View } from "react-native";
import type { ShareExport, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { CalmNote, Card, H3, Hint, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { DayStrip, type DayStripEntry } from "./DayStrip";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);
}

/** The uppercase overline for a section, as in the client app's History. */
function SectionTitle({ children }: { children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <H3
      style={{
        fontSize: 12.5,
        fontWeight: "600",
        letterSpacing: 0.75,
        textTransform: "uppercase",
        color: t.inkSoft,
        marginTop: 11.2,
        marginBottom: 4.8,
      }}
    >
      {children}
    </H3>
  );
}

/** The thread's shared loudness as it stood at the end of a given day. */
function loudnessAt(thread: SharedThread, day: string): number {
  let level = 2;
  for (const entry of thread.loudness) {
    if (entry.at.slice(0, 10) <= day) level = entry.loudness;
    else break;
  }
  return level;
}

/** Whether the thread was still a separate line on this day. */
function openOn(thread: SharedThread, day: string): boolean {
  if (thread.startedOn.slice(0, 10) > day) return false;
  if (thread.integratedOn) return thread.integratedOn.slice(0, 10) > day;
  return true;
}

function decidedOn(thread: SharedThread, day: string): boolean {
  return thread.events.some(
    (e) => e.on.slice(0, 10) === day && (e.kind === "action-decided" || e.kind === "action-done"),
  );
}

function closedOn(thread: SharedThread, day: string): boolean {
  return !!thread.integratedOn && thread.integratedOn.slice(0, 10) === day;
}

/** Everything one recorded day left behind, under its own mini timeline. */
function DaySection({ share, day }: { share: ShareExport; day: string }) {
  const from = share.from.slice(0, 10);

  // The day's standing, drawn the way the client app draws it.
  const entries: DayStripEntry[] = share.threads
    .filter((th) => openOn(th, day))
    .map((th) => ({
      thread: th,
      loudness: loudnessAt(th, day),
      waiting: th.kind === "waiting" || !!th.waiting,
      decided: decidedOn(th, day),
    }));

  const heldSet = new Set(
    entries.filter((e) => !e.decided).flatMap((e) => e.thread.feelings ?? []),
  );
  const returned = [
    ...new Set(
      share.threads
        .filter(
          (th) =>
            (th.feelings?.length ?? 0) > 0 && (decidedOn(th, day) || closedOn(th, day)),
        )
        .flatMap((th) => th.feelings ?? []),
    ),
  ].filter((f) => !heldSet.has(f));

  // The record this day left behind.
  const dayEvents = share.threads.flatMap((th) =>
    th.events
      .filter((e) => e.on.slice(0, 10) === day)
      .map((e) => ({ thread: th, event: e })),
  );
  const decided = dayEvents.filter((d) => d.event.kind === "action-decided");
  const done = dayEvents.filter((d) => d.event.kind === "action-done");
  const moments = dayEvents.filter((d) => d.event.kind === "moment");
  const closed = dayEvents.filter((d) => d.event.kind === "integrated");
  const started = dayEvents.filter((d) => d.event.kind === "started");
  const loudnessMoves = share.threads.flatMap((th) =>
    th.loudness
      .filter((l) => l.at.slice(0, 10) === day && l.at.slice(0, 10) >= from)
      .map((l) => ({ thread: th, level: l.loudness })),
  );

  return (
    <View style={{ marginBottom: 10 }}>
      <SectionTitle>{fmtDay(day)}</SectionTitle>

      {entries.length > 0 && (
        <Card sunken style={{ gap: 4 }}>
          <DayStrip entries={entries} />
        </Card>
      )}
      {returned.length > 0 && (
        <Hint style={{ marginTop: 4, marginBottom: 0 }}>
          Returned by this day's decisions: {returned.join(", ")}
        </Hint>
      )}

      {decided.map(({ thread, event }, i) =>
        event.kind === "action-decided" ? (
          <Card key={`dec-${i}`} sunken>
            <T style={{ fontWeight: "600" }}>{event.title}</T>
            <Hint style={{ marginBottom: 0 }}>
              step decided, toward “{thread.title}”
              {event.durationMinutes ? ` · about ${event.durationMinutes} min` : ""}
            </Hint>
            {event.instruction ? (
              <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.instruction}</Hint>
            ) : null}
          </Card>
        ) : null,
      )}

      {done.map(({ thread, event }, i) =>
        event.kind === "action-done" ? (
          <Card key={`done-${i}`} sunken>
            <T style={{ fontWeight: "600" }}>{event.title}</T>
            <Hint style={{ marginBottom: 0 }}>step done, toward “{thread.title}”</Hint>
          </Card>
        ) : null,
      )}

      {moments.map(({ thread, event }, i) =>
        event.kind === "moment" ? (
          <Card key={`moment-${i}`} sunken>
            <T style={{ fontWeight: "600" }}>{event.title}</T>
            <Hint style={{ marginBottom: 0 }}>
              a moment on “{thread.title}”
              {event.impact != null ? ` · felt impact ${event.impact}/5` : ""}
            </Hint>
            {event.description ? (
              <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.description}</Hint>
            ) : null}
          </Card>
        ) : null,
      )}

      {closed.map(({ thread, event }, i) =>
        event.kind === "integrated" ? (
          <Card key={`closed-${i}`} sunken>
            <T style={{ fontWeight: "600" }}>{thread.title}</T>
            <Hint style={{ marginBottom: 0 }}>
              {event.result === "converted-to-project"
                ? "became real work and left their head"
                : "folded back into their one line"}
              {event.reclaimed && event.reclaimed.length > 0
                ? ` · reclaimed ${event.reclaimed.join(", ")}`
                : ""}
            </Hint>
            {event.resolution ? (
              <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.resolution}</Hint>
            ) : null}
          </Card>
        ) : null,
      )}

      {started.map(({ thread }, i) => (
        <Card key={`started-${i}`} sunken>
          <T style={{ fontWeight: "600" }}>{thread.title}</T>
          <Hint style={{ marginBottom: 0 }}>began pulling on them this day</Hint>
        </Card>
      ))}

      {loudnessMoves.map(({ thread, level }, i) => (
        <Card key={`loud-${i}`} sunken>
          <T style={{ fontWeight: "600" }}>{thread.title}</T>
          <Hint style={{ marginBottom: 0 }}>loudness moved to {level}</Hint>
        </Card>
      ))}
    </View>
  );
}

/**
 * The whole shared window, day after day under each other, oldest first —
 * each recorded day opening with a miniature of the client app's timeline:
 * every open thread's pull, feelings and intensity, alive the way the
 * client sees them. Days that left no record fold into a quiet line.
 */
export function DayByDayList({ share }: { share: ShareExport }) {
  const from = share.from.slice(0, 10);
  const to = share.to.slice(0, 10);

  /** Days that left any record. */
  const recordedDays = useMemo(() => {
    const days = new Set<string>();
    for (const th of share.threads) {
      for (const e of th.events) days.add(e.on.slice(0, 10));
      for (const l of th.loudness) {
        const d = l.at.slice(0, 10);
        if (d >= from) days.add(d);
      }
    }
    return days;
  }, [share, from]);

  // Walk the window once: recorded days in full, quiet runs folded.
  const blocks: ({ kind: "day"; day: string } | { kind: "quiet"; from: string; to: string })[] =
    [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (recordedDays.has(day)) {
      blocks.push({ kind: "day", day });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "quiet") last.to = day;
      else blocks.push({ kind: "quiet", from: day, to: day });
    }
  }

  if (recordedDays.size === 0) {
    return (
      <CalmNote style={{ marginTop: 8 }}>
        <T>Nothing was recorded in this window. The days simply passed.</T>
      </CalmNote>
    );
  }

  return (
    <View>
      {blocks.map((block) =>
        block.kind === "day" ? (
          <DaySection key={block.day} share={share} day={block.day} />
        ) : (
          <Hint key={block.from} style={{ marginTop: 2, marginBottom: 8 }}>
            {block.from === block.to
              ? `${fmtDay(block.from)} — nothing recorded. It simply passed.`
              : `${fmtDay(block.from)} – ${fmtDay(block.to)} — nothing recorded. These days simply passed.`}
          </Hint>
        ),
      )}
    </View>
  );
}
