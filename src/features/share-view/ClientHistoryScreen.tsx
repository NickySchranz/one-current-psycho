import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { mergeShares } from "@/domain/merge-shares";
import { Button, Hint, Panel } from "@/ui/primitives";
import { ShareView } from "./ShareScreen";
import { previousShareTo } from "./whats-new";

/**
 * Every share file a client handed over, merged into one continuous
 * timeline — the whole history in the shared language, not one window
 * at a time.
 */
export function ClientHistoryScreen({ clientId }: { clientId: string }) {
  const allShares = useAppStore((s) => s.shares);
  const setView = useAppStore((s) => s.setView);

  const shares = useMemo(
    () => allShares.filter((sh) => sh.clientId === clientId && !("springs" in sh.data)),
    [allShares, clientId],
  );

  const merged = useMemo(
    () => (shares.length > 0 ? mergeShares(shares.map((sh) => sh.data as import("@/domain/share-types").ShareExport)) : null),
    [shares],
  );

  // Highlight what arrived with the latest file: everything after the
  // previous file's window still counts as new since the last session.
  const newSince = useMemo(() => {
    if (shares.length < 2) return null;
    const newest = shares.reduce((a, b) => (b.data.to > a.data.to ? b : a));
    return previousShareTo(newest, shares);
  }, [shares]);

  if (!merged) {
    return (
      <ScrollView style={{ flex: 1 }}>
        <Panel>
          <Hint>This client has no shared files.</Hint>
          <Button label="Back" onPress={() => setView({ kind: "client", clientId })} />
        </Panel>
      </ScrollView>
    );
  }

  return (
    <ShareView
      data={merged}
      newSince={newSince}
      subtitle={
        shares.length > 1 ? `combined from ${shares.length} shared files` : undefined
      }
    />
  );
}
