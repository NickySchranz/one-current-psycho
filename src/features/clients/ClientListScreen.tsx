import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { byRecentActivity, clientSummary } from "@/domain/client-activity";
import { fmtDay } from "@/domain/dates";
import { IncomingShares } from "@/features/clients/IncomingShares";
import {
  AppTextInput,
  Button,
  Card,
  Field,
  H1,
  H2,
  H3,
  Hint,
  Panel,
  T,
  rowStyles,
} from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/** The practice's client list: open a client, add one, or load examples. */
export function ClientListScreen() {
  const t = useTheme();
  const clients = useAppStore((s) => s.clients);
  const shares = useAppStore((s) => s.shares);
  const sessionNotes = useAppStore((s) => s.sessionNotes);
  const setView = useAppStore((s) => s.setView);
  const addClient = useAppStore((s) => s.addClient);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const loadExampleClients = useAppStore((s) => s.loadExampleClients);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      clients
        .map((client) => ({ client, summary: clientSummary(client, shares, sessionNotes) }))
        .sort(byRecentActivity),
    [clients, shares, sessionNotes],
  );

  return (
    <ScrollView style={{ flex: 1 }}>
      <Panel>
        <H1>Clients</H1>
        <Hint>
          Each client can hand you share files exported from their One Current app. Import a
          file on the client's page to see their shared window on a timeline.
        </Hint>

        <IncomingShares />

        {clients.length === 0 && (
          <Card>
            <Hint style={{ marginBottom: 0 }}>
              No clients yet. Add one below, or load the example clients to explore.
            </Hint>
          </Card>
        )}

        {rows.map(({ client: c, summary }) => {
          const meta =
            summary.shareCount === 0
              ? ["No shared files yet"]
              : [
                  summary.openThreads === 1
                    ? "1 open thread"
                    : `${summary.openThreads} open threads`,
                  summary.latestExportedAt
                    ? `latest export ${fmtDay(summary.latestExportedAt)}`
                    : null,
                ];
          if (summary.lastNoteOn) meta.push(`last note ${fmtDay(summary.lastNoteOn)}`);
          return (
            <Card key={c.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${c.name}`}
                onPress={() => setView({ kind: "client", clientId: c.id })}
              >
                <H3 style={{ marginBottom: 2 }}>{c.name}</H3>
                {c.notes ? <Hint style={{ marginBottom: 4 }}>{c.notes}</Hint> : null}
                <T style={{ fontSize: 13.6, color: t.inkSoft }}>
                  {meta.filter(Boolean).join(" · ")}
                </T>
              </Pressable>
              <View style={[rowStyles.filterRow, { marginTop: 10 }]}>
                <Button
                  label="Open"
                  onPress={() => setView({ kind: "client", clientId: c.id })}
                />
                {confirmingId !== c.id ? (
                  <Button
                    variant="danger"
                    label="Delete"
                    onPress={() => setConfirmingId(c.id)}
                  />
                ) : (
                  <>
                    <T style={{ flexShrink: 1, fontSize: 14 }}>
                      Delete {c.name} and all their shared files?
                    </T>
                    <Button
                      variant="danger"
                      label="Yes, delete"
                      onPress={() => {
                        void deleteClient(c.id);
                        setConfirmingId(null);
                      }}
                    />
                    <Button label="Keep" onPress={() => setConfirmingId(null)} />
                  </>
                )}
              </View>
            </Card>
          );
        })}

        <H2>Add a client</H2>
        <Card>
          <Field label="Name">
            <AppTextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Maya R."
              accessibilityLabel="Client name"
            />
          </Field>
          <Field label="Notes (optional)">
            <AppTextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Session day, focus…"
              accessibilityLabel="Client notes"
            />
          </Field>
          <Button
            variant="primary"
            style={{ alignSelf: "flex-start" }}
            disabled={name.trim() === ""}
            label="Add client"
            onPress={() => {
              void addClient(name, notes);
              setName("");
              setNotes("");
            }}
          />
        </Card>

        <H2>Explore</H2>
        <Card>
          <Hint>
            Two example clients with realistic shared files, so you can see how a share looks
            before a real one arrives. You can delete them any time.
          </Hint>
          <Button
            style={{ alignSelf: "flex-start" }}
            label="Load example clients"
            onPress={() => void loadExampleClients()}
          />
        </Card>
      </Panel>
    </ScrollView>
  );
}
