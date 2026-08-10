import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { fmtDay } from "@/domain/dates";
import {
  AppTextInput,
  Button,
  Card,
  H1,
  H2,
  Hint,
  Panel,
  T,
  rowStyles,
} from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/** One client: their shared files, plus importing a new file. */
export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const t = useTheme();
  const client = useAppStore((s) => s.clients.find((c) => c.id === clientId));
  const shares = useAppStore((s) => s.shares).filter((sh) => sh.clientId === clientId);
  const setView = useAppStore((s) => s.setView);
  const importShare = useAppStore((s) => s.importShare);
  const deleteShare = useAppStore((s) => s.deleteShare);
  const deleteClient = useAppStore((s) => s.deleteClient);

  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingClient, setConfirmingClient] = useState(false);
  // Native fallback: no file picker wired, so the share file is pasted as text.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  if (!client) {
    return (
      <ScrollView style={{ flex: 1 }}>
        <Panel>
          <Hint>This client no longer exists.</Hint>
          <Button label="Back to clients" onPress={() => setView({ kind: "clients" })} />
        </Panel>
      </ScrollView>
    );
  }

  async function doImport(text: string) {
    try {
      setError("");
      await importShare(clientId, text);
      setPasteOpen(false);
      setPasteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
    }
  }

  function pickImport() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = () => {
        const f = input.files?.[0];
        if (f) void f.text().then((text) => doImport(text));
      };
      input.click();
      return;
    }
    setPasteOpen((v) => !v);
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <Panel>
        <H1>{client.name}</H1>
        {client.notes ? <Hint>{client.notes}</Hint> : null}

        <H2>Shared files</H2>
        {shares.length === 0 && (
          <Card>
            <Hint style={{ marginBottom: 0 }}>
              Nothing shared yet. Import the file your client handed you.
            </Hint>
          </Card>
        )}
        {shares.map((sh) => (
          <Card key={sh.id}>
            <T style={{ fontWeight: "600" }}>
              {fmtDay(sh.data.from)} → {fmtDay(sh.data.to)}
            </T>
            <T style={{ fontSize: 13.6, color: t.inkSoft, marginTop: 2 }}>
              {sh.data.threads.length === 1 ? "1 thread" : `${sh.data.threads.length} threads`}
              {" · exported "}
              {fmtDay(sh.data.exportedAt)}
            </T>
            <View style={[rowStyles.filterRow, { marginTop: 10 }]}>
              <Button
                variant="primary"
                label="View"
                onPress={() => setView({ kind: "share", clientId, shareId: sh.id })}
              />
              {confirmingId !== sh.id ? (
                <Button variant="danger" label="Delete" onPress={() => setConfirmingId(sh.id)} />
              ) : (
                <>
                  <T style={{ flexShrink: 1, fontSize: 14 }}>Delete this shared file?</T>
                  <Button
                    variant="danger"
                    label="Yes, delete"
                    onPress={() => {
                      void deleteShare(sh.id);
                      setConfirmingId(null);
                    }}
                  />
                  <Button label="Keep" onPress={() => setConfirmingId(null)} />
                </>
              )}
            </View>
          </Card>
        ))}

        <H2>Import a shared file</H2>
        <Card>
          <Hint>
            Your client exports this file from One Current under More → Share with a
            psychologist. It only holds what they chose to share.
          </Hint>
          <Button
            style={{ alignSelf: "flex-start" }}
            label="Import a share file"
            onPress={pickImport}
          />
          {pasteOpen && Platform.OS !== "web" && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <AppTextInput
                multiline
                value={pasteText}
                onChangeText={setPasteText}
                accessibilityLabel="Share file contents"
                placeholder="Paste the share file's contents here"
              />
              <Button
                style={{ alignSelf: "flex-start" }}
                disabled={pasteText.trim() === ""}
                label="Import"
                onPress={() => void doImport(pasteText)}
              />
            </View>
          )}
          {error !== "" && (
            <Hint style={{ color: t.danger, marginTop: 8, marginBottom: 0 }}>{error}</Hint>
          )}
        </Card>

        <View style={[rowStyles.filterRow, { marginTop: 8 }]}>
          {!confirmingClient ? (
            <Button
              variant="danger"
              label="Delete this client"
              onPress={() => setConfirmingClient(true)}
            />
          ) : (
            <>
              <T style={{ flexShrink: 1, fontSize: 14 }}>
                Delete {client.name} and all their shared files?
              </T>
              <Button
                variant="danger"
                label="Yes, delete"
                onPress={() => void deleteClient(clientId)}
              />
              <Button label="Keep" onPress={() => setConfirmingClient(false)} />
            </>
          )}
        </View>
      </Panel>
    </ScrollView>
  );
}
