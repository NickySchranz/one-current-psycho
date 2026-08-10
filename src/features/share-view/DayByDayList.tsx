import { useMemo, useState } from "react";
import { View } from "react-native";
import type { ShareExport, SharedThread } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Button, CalmNote, Card, H1, H3, Hint, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { isClosedThread } from "./timeline/geometry";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Weight the main line carries regardless of threads (as in the client app). */
const MAIN_BASE = 12;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);
}

/** The uppercase overline for a day section, as in the client app's History. */
function DaySectionTitle({ children }: { children?: React.ReactNode }) {
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

/**
 * One shared day at a time, laid out like the client app's own History page:
 * where the energy went, which feelings were held, and the record the day
 * left behind. Step through the window with the arrows.
 */
export function DayByDayList({ share }: { share: ShareExport }) {
  const tokens = useTheme();
  const from = share.from.slice(0, 10);
  const to = share.to.slice(0, 10);
  const [day, setDay] = useState(to);

  /** Days that left any record, for the "next recorded day" hint. */
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

  // Where the day's energy went — the client app's energySplit, computed
  // from the shared history: waiting calms the draw, a decision shrinks it.
  const loads = share.threads
    .filter((th) => openOn(th, day))
    .map((th) => {
      let load = loudnessAt(th, day);
      if (th.kind === "waiting" || th.waiting) load *= 0.25;
      else if (decidedOn(th, day)) load *= 0.3;
      return { thread: th, load };
    })
    .filter((l) => l.load > 0)
    .sort((a, b) => b.load - a.load);
  const total = MAIN_BASE + loads.reduce((s, l) => s + l.load, 0);
  const mainShare = MAIN_BASE / total;

  const held = share.threads
    .filter((th) => openOn(th, day) && !decidedOn(th, day) && (th.feelings?.length ?? 0) > 0)
    .sort((a, b) => (b.feelings?.length ?? 0) - (a.feelings?.length ?? 0));
  const heldSet = new Set(held.flatMap((th) => th.feelings ?? []));
  const returned = [
    ...new Set(
      share.threads
        .filter(
          (th) =>
            (th.feelings?.length ?? 0) > 0 &&
            (decidedOn(th, day) || closedOn(th, day)),
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
  const empty =
    decided.length === 0 &&
    done.length === 0 &&
    moments.length === 0 &&
    closed.length === 0 &&
    started.length === 0 &&
    loudnessMoves.length === 0;

  return (
    <View>
      {/* The day itself is the header: step through the shared window here. */}
      <View
        accessibilityLabel="Shared days"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 6.4,
          marginBottom: 3.2,
        }}
      >
        <Button
          variant="quiet"
          accessibilityLabel="Previous day"
          disabled={day <= from}
          onPress={() => setDay((d) => (d > from ? addDays(d, -1) : d))}
          style={{ paddingVertical: 1, paddingHorizontal: 9.6 }}
          textStyle={{ fontSize: 17.6 }}
          label="‹"
        />
        <H1 style={{ marginBottom: 0, minWidth: 128, textAlign: "center" }}>{fmtDay(day)}</H1>
        <Button
          variant="quiet"
          accessibilityLabel="Next day"
          disabled={day >= to}
          onPress={() => setDay((d) => (d < to ? addDays(d, 1) : d))}
          style={{ paddingVertical: 1, paddingHorizontal: 9.6 }}
          textStyle={{ fontSize: 17.6 }}
          label="›"
        />
        {!recordedDays.has(day) && (
          <Hint style={{ marginBottom: 0, flexShrink: 1 }}>
            {recordedDays.size === 0 ? "" : "Nothing recorded — keep stepping."}
          </Hint>
        )}
      </View>

      <Card sunken style={{ gap: 6.4 }}>
        <DaySectionTitle>Energy · feelings</DaySectionTitle>
        <View
          accessibilityRole="image"
          accessibilityLabel={`About ${Math.round(mainShare * 100)} percent of their energy moved with the main line this day.`}
          style={{
            flexDirection: "row",
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            backgroundColor: tokens.bgSunken,
          }}
        >
          <View style={{ width: `${mainShare * 100}%`, backgroundColor: tokens.accent }} />
          {loads.map((l, i) => (
            <View
              key={l.thread.id}
              style={{
                width: `${(l.load / total) * 100}%`,
                backgroundColor: tokens.inkFaint,
                opacity: 0.55,
                borderLeftWidth: i > 0 ? 1 : 0,
                borderLeftColor: tokens.bg,
              }}
            />
          ))}
        </View>
        <Hint style={{ marginBottom: 0 }}>
          {loads.length === 0
            ? "All of them moved with their main line."
            : loads.length === 1
              ? "1 shared line was drawing on them this day."
              : `${loads.length} shared lines were drawing on them this day.`}
        </Hint>
        {returned.length > 0 && (
          <Hint style={{ marginBottom: 0 }}>
            Returned by this day's decisions: {returned.join(", ")}
          </Hint>
        )}
        {held.map((th) => (
          <Hint key={th.id} style={{ marginBottom: 0 }}>
            “{th.title}” still holds {(th.feelings ?? []).join(", ")}
          </Hint>
        ))}
      </Card>

      {decided.length > 0 && (
        <>
          <DaySectionTitle>Steps decided on</DaySectionTitle>
          {decided.map(({ thread, event }, i) =>
            event.kind === "action-decided" ? (
              <Card key={i} sunken>
                <T style={{ fontWeight: "600" }}>{event.title}</T>
                <Hint style={{ marginBottom: 0 }}>
                  toward “{thread.title}”
                  {event.durationMinutes ? ` · about ${event.durationMinutes} min` : ""}
                </Hint>
                {event.instruction ? (
                  <Hint style={{ marginTop: 4, marginBottom: 0 }}>{event.instruction}</Hint>
                ) : null}
              </Card>
            ) : null,
          )}
        </>
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

      {loudnessMoves.length > 0 && (
        <>
          <DaySectionTitle>Loudness</DaySectionTitle>
          {loudnessMoves.map(({ thread, level }, i) => (
            <Card key={`loud-${i}`} sunken>
              <T style={{ fontWeight: "600" }}>{thread.title}</T>
              <Hint style={{ marginBottom: 0 }}>loudness moved to {level}</Hint>
            </Card>
          ))}
        </>
      )}

      {empty && (
        <CalmNote style={{ marginTop: 8 }}>
          <T>Nothing was recorded on this day. It simply passed.</T>
        </CalmNote>
      )}
    </View>
  );
}
