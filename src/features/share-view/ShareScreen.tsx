import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { fmtDay } from "@/domain/dates";
import { Button, Chip, H1, Hint, Panel, rowStyles } from "@/ui/primitives";
import { DayByDayList } from "./DayByDayList";
import { ShareOverview } from "./ShareOverview";
import { ThreadDetail } from "./ThreadDetail";
import { ShareTimeline } from "./timeline/ShareTimeline";
import type { Selection } from "./selection";

/**
 * One imported share. The summarized timeline always stays on top — it is
 * the shared language between client and psychologist. Below it, the
 * content follows the focus: an overview spread when nothing is held,
 * the focused thread's spread when a line is tapped, and the day-by-day
 * record on its own tab.
 */
export function ShareScreen({ clientId, shareId }: { clientId: string; shareId: string }) {
  const share = useAppStore((s) => s.shares.find((sh) => sh.id === shareId));
  const setView = useAppStore((s) => s.setView);
  const [tab, setTab] = useState<"overview" | "days">("overview");
  const [selection, setSelection] = useState<Selection | null>(null);

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

  const data = share.data;

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
        <H1>
          {fmtDay(data.from)} → {fmtDay(data.to)}
        </H1>
        <Hint>
          {data.threads.length === 1 ? "1 thread" : `${data.threads.length} threads`} shared ·
          exported {fmtDay(data.exportedAt)}. Only what the client chose to share appears here.
        </Hint>

        {/* the timeline always stays */}
        <ShareTimeline share={data} selection={selection} onSelect={select} />

        <View style={[rowStyles.filterRow, { marginTop: 14, marginBottom: 12 }]}>
          <Chip
            label={selectedThread ? "Thread in focus" : "Overview"}
            pressed={tab === "overview"}
            onPress={() => setTab("overview")}
          />
          <Chip label="Day by day" pressed={tab === "days"} onPress={() => setTab("days")} />
        </View>

        {tab === "days" ? (
          <DayByDayList share={data} />
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
