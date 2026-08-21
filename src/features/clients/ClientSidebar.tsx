import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type PressableStateCallbackType,
} from "react-native";
import { useAppStore } from "@/stores/app-store";
import { byRecentActivity, clientSummary } from "@/domain/client-activity";
import { fmtDay } from "@/domain/dates";
import { IncomingShares } from "@/features/clients/IncomingShares";
import { alpha } from "@/ui/color";
import { AppTextInput, Button, H3, Hint, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/**
 * Wide-screen client list: a persistent sidebar. Selecting a client swaps
 * the main pane, like picking a ticket in a queue.
 */
export function ClientSidebar() {
  const t = useTheme();
  const clients = useAppStore((s) => s.clients);
  const shares = useAppStore((s) => s.shares);
  const sessionNotes = useAppStore((s) => s.sessionNotes);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const addClient = useAppStore((s) => s.addClient);
  const loadExampleClients = useAppStore((s) => s.loadExampleClients);

  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const selectedId =
    view.kind === "client" || view.kind === "share" ? view.clientId : undefined;
  const rows = useMemo(
    () =>
      clients
        .map((client) => ({ client, summary: clientSummary(client, shares, sessionNotes) }))
        .sort(byRecentActivity),
    [clients, shares, sessionNotes],
  );
  const shown = rows.filter(({ client: c }) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <View
      style={{
        width: 300,
        borderRightWidth: 1,
        borderRightColor: alpha(t.lineAxis, 0.55),
        backgroundColor: alpha(t.bgRaised, 0.5),
      }}
    >
      <View
        style={{
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: alpha(t.lineAxis, 0.4),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <H3 style={{ marginBottom: 0, marginRight: "auto" }}>Clients</H3>
          <Button
            variant="quiet"
            label={adding ? "Close" : "+ Add"}
            onPress={() => setAdding((v) => !v)}
          />
        </View>
        {clients.length > 5 && (
          <AppTextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Find a client…"
            accessibilityLabel="Find a client"
            style={{ marginTop: 8, minHeight: 36, paddingVertical: 6 }}
          />
        )}
        {adding && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <AppTextInput
              value={name}
              onChangeText={setName}
              placeholder="Name, e.g. Maya R."
              accessibilityLabel="Client name"
              style={{ minHeight: 36, paddingVertical: 6 }}
            />
            <AppTextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              accessibilityLabel="Client notes"
              style={{ minHeight: 36, paddingVertical: 6 }}
            />
            <Button
              variant="primary"
              disabled={name.trim() === ""}
              label="Add client"
              onPress={() => {
                void addClient(name, notes);
                setName("");
                setNotes("");
                setAdding(false);
              }}
            />
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }}>
        <IncomingShares compact />
        {clients.length === 0 && (
          <View style={{ padding: 16 }}>
            <Hint>No clients yet. Add one above, or load the examples to explore.</Hint>
            <Button label="Load example clients" onPress={() => void loadExampleClients()} />
          </View>
        )}
        {shown.length === 0 && clients.length > 0 && (
          <Hint style={{ padding: 16 }}>No client matches “{filter.trim()}”.</Hint>
        )}
        {shown.map(({ client: c, summary }) => {
          const selected = c.id === selectedId;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${c.name}`}
              accessibilityState={{ selected }}
              onPress={() => setView({ kind: "client", clientId: c.id })}
              style={(state) => {
                // Web adds `hovered` to Pressable's style-state; native never sets it.
                const hovered = !!(state as PressableStateCallbackType & { hovered?: boolean })
                  .hovered;
                return {
                paddingVertical: 11,
                paddingHorizontal: 16,
                borderLeftWidth: 3,
                borderLeftColor: selected ? t.accent : "transparent",
                backgroundColor: selected
                  ? t.accentSoft
                  : hovered
                    ? t.bgSunken
                    : "transparent",
                  borderBottomWidth: 1,
                  borderBottomColor: alpha(t.lineAxis, 0.25),
                };
              }}
            >
              <T numberOfLines={1} style={{ fontSize: 15.2, fontWeight: "600" }}>
                {c.name}
              </T>
              {c.notes ? (
                <T numberOfLines={1} style={{ fontSize: 12.8, color: t.inkSoft, marginTop: 1 }}>
                  {c.notes}
                </T>
              ) : null}
              <T style={{ fontSize: 12.8, color: t.inkFaint, marginTop: 2 }}>
                {summary.shareCount === 0
                  ? "No shared files"
                  : `${summary.shareCount} ${summary.shareCount === 1 ? "share" : "shares"} · ${summary.openThreads} open${summary.springCount > 0 ? ` · ${summary.springCount} springs` : ""} · ${fmtDay(summary.latestExportedAt ?? c.createdAt)}`}
              </T>
            </Pressable>
          );
        })}
        {clients.length > 0 && (
          <View style={{ padding: 16 }}>
            <Button
              variant="quiet"
              label="Load example clients"
              onPress={() => void loadExampleClients()}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
