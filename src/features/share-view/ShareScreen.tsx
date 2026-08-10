import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { fmtDay } from "@/domain/dates";
import { Button, Chip, H1, Hint, Panel, rowStyles } from "@/ui/primitives";
import { DayByDayList } from "./DayByDayList";
import { ShareTimeline } from "./timeline/ShareTimeline";

/** One imported share: a read-only timeline and a day-by-day record. */
export function ShareScreen({ clientId, shareId }: { clientId: string; shareId: string }) {
  const share = useAppStore((s) => s.shares.find((sh) => sh.id === shareId));
  const setView = useAppStore((s) => s.setView);
  const [tab, setTab] = useState<"timeline" | "days">("timeline");

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
        <View style={[rowStyles.filterRow, { marginBottom: 14 }]}>
          <Chip label="Timeline" pressed={tab === "timeline"} onPress={() => setTab("timeline")} />
          <Chip label="Day by day" pressed={tab === "days"} onPress={() => setTab("days")} />
        </View>
        {tab === "timeline" ? <ShareTimeline share={data} /> : <DayByDayList share={data} />}
      </Panel>
    </ScrollView>
  );
}
