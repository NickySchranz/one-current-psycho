import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import type { ShareExport } from "@/domain/share-types";
import { fmtDay } from "@/domain/dates";
import { Button, CalmNote, Chip, H1, Hint, Panel, T, rowStyles } from "@/ui/primitives";
import { DayByDayList } from "./DayByDayList";
import { ShareOverview } from "./ShareOverview";
import { ThreadDetail } from "./ThreadDetail";
import { ShareTimeline } from "./timeline/ShareTimeline";
import { previousShareTo, whatsNew } from "./whats-new";
import type { Selection } from "./selection";

/**
 * One share's content. The summarized timeline always stays on top — it is
 * the shared language between client and psychologist. Below it, the
 * content follows the focus: an overview spread when nothing is held,
 * the focused thread's spread when a line is tapped, and the day-by-day
 * record on its own tab.
 */
export function ShareView({
  data,
  newSince,
  subtitle,
}: {
  data: ShareExport;
  /** Day after which events count as new since the last session, if known. */
  newSince?: string | null;
  /** Replaces the default "exported …" line under the heading. */
  subtitle?: string;
}) {
  const [tab, setTab] = useState<"overview" | "days">("overview");
  const [selection, setSelection] = useState<Selection | null>(null);

  const fresh = useMemo(
    () => (newSince ? whatsNew(data, newSince) : null),
    [data, newSince],
  );

  /** Tapping the timeline pulls the content below back to the focus. */
  const select = (s: Selection | null) => {
    setSelection(s);
    if (s) setTab("overview");
  };

  const selectedThread = selection
    ? data.threads.find((th) => th.id === selection.threadId)
    : undefined;

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

        {/* the timeline always stays */}
        <ShareTimeline share={data} selection={selection} onSelect={select} />

        <View style={[rowStyles.filterRow, { marginTop: 16, marginBottom: 16 }]}>
          <Chip
            label={selectedThread ? "Thread in focus" : "Overview"}
            pressed={tab === "overview"}
            onPress={() => setTab("overview")}
          />
          <Chip label="Day by day" pressed={tab === "days"} onPress={() => setTab("days")} />
        </View>

        {tab === "days" ? (
          <DayByDayList share={data} newSince={newSince ?? undefined} />
        ) : selectedThread ? (
          <ThreadDetail
            thread={selectedThread}
            eventIndex={selection?.type === "event" ? selection.index : null}
            onSelect={select}
          />
        ) : (
          <ShareOverview share={data} onSelect={select} />
        )}
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
