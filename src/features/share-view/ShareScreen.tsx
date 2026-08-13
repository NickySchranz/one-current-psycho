import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import type { ShareExport } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Button, CalmNote, Disclosure, H1, Hint, Panel, T } from "@/ui/primitives";
import { DayByDayList } from "./DayByDayList";
import { SharePulse } from "./SharePulse";
import { ThreadList } from "./ThreadList";
import { ShareTimeline } from "./timeline/ShareTimeline";
import { previousShareTo, whatsNew } from "./whats-new";
import type { Selection } from "./selection";

const DAY_MS = 24 * 60 * 60 * 1000;

function windowWeeks(from: string, to: string): number {
  const ms = Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z");
  return Math.max(1, Math.round(ms / DAY_MS / 7));
}

function recordedDayCount(share: ShareExport): number {
  const from = share.from.slice(0, 10);
  const days = new Set<string>();
  for (const th of share.threads) {
    for (const e of th.events) days.add(e.on.slice(0, 10));
    for (const l of th.loudness) {
      const d = l.at.slice(0, 10);
      if (d >= from) days.add(d);
    }
  }
  return days.size;
}

/**
 * One share's content. The pulse leads — what's pulling hardest, at a
 * glance. Below it, every thread in a scannable list that expands inline.
 * The timeline and day-by-day record stay available behind disclosures:
 * always reachable, never overwhelming on first open.
 */
export function ShareView({
  data,
  newSince,
  subtitle,
}: {
  data: ShareExport;
  newSince?: string | null;
  subtitle?: string;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);

  const fresh = useMemo(
    () => (newSince ? whatsNew(data, newSince) : null),
    [data, newSince],
  );

  const select = (s: Selection | null) => {
    setSelection(s);
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <Panel wide>
        <H1 style={{ marginBottom: 4 }}>
          {fmtDay(data.from)} → {fmtDay(data.to)}
        </H1>
        <Hint style={{ marginBottom: 0 }}>
          {data.threads.length === 1 ? "1 thread" : `${data.threads.length} threads`} shared ·{" "}
          {subtitle ?? `exported ${fmtDay(data.exportedAt)}`}. Only what the client chose to
          share appears here.
        </Hint>

        {newSince && fresh ? (
          fresh.total > 0 ? (
            <CalmNote style={{ marginTop: 12 }}>
              <T>
                Since the last shared file (up to {fmtDay(newSince)}): {fresh.summary}.
              </T>
            </CalmNote>
          ) : (
            <Hint style={{ marginTop: 12, marginBottom: 0 }}>
              Nothing new since the last shared file (up to {fmtDay(newSince)}).
            </Hint>
          )
        ) : null}

        {/* the pulse: at-a-glance loudness summary */}
        <SharePulse share={data} onSelect={select} />

        {/* timeline behind a disclosure */}
        <Disclosure
          label={`Timeline — ${data.threads.length} thread${data.threads.length === 1 ? "" : "s"} across ${windowWeeks(data.from, data.to)} week${windowWeeks(data.from, data.to) === 1 ? "" : "s"}`}
        >
          <ShareTimeline share={data} selection={selection} onSelect={select} />
          <Hint style={{ marginTop: 4, marginBottom: 0 }}>
            Louder threads sit further from the main line, draw heavier and tremble.
            Tap a line for the thread, a dot for what happened there.
          </Hint>
        </Disclosure>

        {/* every thread, expandable in place */}
        <View style={{ marginTop: 20 }}>
          <ThreadList share={data} selection={selection} onSelect={select} />
        </View>

        {/* day by day behind a disclosure */}
        <Disclosure
          label={`Day by day — ${recordedDayCount(data)} recorded day${recordedDayCount(data) === 1 ? "" : "s"}`}
        >
          <DayByDayList share={data} newSince={newSince ?? undefined} />
        </Disclosure>
      </Panel>
    </ScrollView>
  );
}

/** One imported share, looked up from the store. */
export function ShareScreen({ clientId, shareId }: { clientId: string; shareId: string }) {
  const share = useAppStore((s) => s.shares.find((sh) => sh.id === shareId));
  const shares = useAppStore((s) => s.shares);
  const setView = useAppStore((s) => s.setView);

  const newSince = useMemo(
    () => (share ? previousShareTo(share, shares) : null),
    [share, shares],
  );

  if (!share) {
    return (
      <ScrollView style={{ flex: 1 }}>
        <Panel>
          <Hint>This shared file no longer exists.</Hint>
          <Button
            label="Back"
            onPress={() => setView({ kind: "client", clientId })}
          />
        </Panel>
      </ScrollView>
    );
  }

  return <ShareView data={share.data} newSince={newSince} />;
}
