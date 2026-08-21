import { useState } from "react";
import { View } from "react-native";
import { useAppStore } from "@/stores/app-store";
import { fmtDay } from "@/domain/dates";
import { alpha } from "@/ui/color";
import { Button, Card, H2, Hint, T, rowStyles } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/**
 * Shares that patients addressed to this practitioner's email, waiting to be
 * accepted. Accepting asks which client the share belongs to — an existing
 * one, or a new client pre-filled with the sender's name.
 */
export function IncomingShares({ compact = false }: { compact?: boolean }) {
  const t = useTheme();
  const inbox = useAppStore((s) => s.inbox);
  const inboxStatus = useAppStore((s) => s.inboxStatus);
  const loadInbox = useAppStore((s) => s.loadInbox);
  const acceptInboxShare = useAppStore((s) => s.acceptInboxShare);
  const addClient = useAppStore((s) => s.addClient);
  const clients = useAppStore((s) => s.clients);
  const setView = useAppStore((s) => s.setView);

  const [pickingId, setPickingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (inbox.length === 0 && inboxStatus !== "error") return null;

  async function accept(shareId: string, clientId: string) {
    setBusyId(shareId);
    setError("");
    try {
      await acceptInboxShare(shareId, clientId);
      setPickingId(null);
      setView({ kind: "client", clientId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The share could not be accepted.");
    } finally {
      setBusyId(null);
    }
  }

  async function acceptIntoNewClient(shareId: string, senderName: string) {
    setBusyId(shareId);
    setError("");
    try {
      const client = await addClient(senderName);
      await acceptInboxShare(shareId, client.id);
      setPickingId(null);
      setView({ kind: "client", clientId: client.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The share could not be accepted.");
    } finally {
      setBusyId(null);
    }
  }

  const wrap = compact
    ? { paddingHorizontal: 16, paddingTop: 12 }
    : undefined;

  return (
    <View style={wrap}>
      {compact ? (
        <T style={{ fontSize: 13.6, fontWeight: "600", marginBottom: 6 }}>
          Incoming shares
        </T>
      ) : (
        <H2 style={{ marginTop: 0 }}>Incoming shares</H2>
      )}
      {inboxStatus === "error" && inbox.length === 0 ? (
        <Card>
          <View style={rowStyles.filterRow}>
            <Hint style={{ marginBottom: 0, flexShrink: 1 }}>
              The inbox could not be loaded.
            </Hint>
            <Button label="Try again" onPress={() => void loadInbox()} />
          </View>
        </Card>
      ) : (
        inbox.map((item) => {
          const senderName = item.fromName?.trim() || item.fromEmail;
          const busy = busyId === item.id;
          return (
            <Card key={item.id}>
              <T style={{ fontWeight: "600" }} numberOfLines={1}>
                {senderName}
              </T>
              {item.fromName ? (
                <T
                  numberOfLines={1}
                  style={{ fontSize: 12.8, color: t.inkSoft, marginTop: 1 }}
                >
                  {item.fromEmail}
                </T>
              ) : null}
              <T style={{ fontSize: 13.6, color: t.inkSoft, marginTop: 4 }}>
                {fmtDay(item.from)} → {fmtDay(item.to)} ·{" "}
                {item.kind === "wellspring"
                  ? `${item.springCount ?? 0} ${item.springCount === 1 ? "spring" : "springs"} · Wellspring`
                  : item.threadCount === 1
                    ? "1 thread"
                    : `${item.threadCount} threads`}
              </T>
              <T style={{ fontSize: 12.8, color: t.inkFaint, marginTop: 2 }}>
                Expires {fmtDay(item.expiresAt)}
              </T>
              {pickingId !== item.id ? (
                <Button
                  variant="primary"
                  style={{ alignSelf: "flex-start", marginTop: 10 }}
                  label="Accept…"
                  onPress={() => {
                    setPickingId(item.id);
                    setError("");
                  }}
                />
              ) : (
                <View
                  style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: alpha(t.lineAxis, 0.4),
                    gap: 6,
                  }}
                >
                  <Hint style={{ marginBottom: 0 }}>Which client is this share for?</Hint>
                  <View style={rowStyles.filterRow}>
                    {clients.map((c) => (
                      <Button
                        key={c.id}
                        disabled={busy}
                        label={c.name}
                        onPress={() => void accept(item.id, c.id)}
                      />
                    ))}
                    <Button
                      variant="primary"
                      disabled={busy}
                      label={`+ New client “${senderName}”`}
                      onPress={() => void acceptIntoNewClient(item.id, senderName)}
                    />
                    <Button
                      variant="quiet"
                      disabled={busy}
                      label="Cancel"
                      onPress={() => setPickingId(null)}
                    />
                  </View>
                  {busy && (
                    <Hint style={{ marginBottom: 0 }}>Accepting…</Hint>
                  )}
                  {error !== "" && !busy && (
                    <T style={{ color: t.danger, fontSize: 13.6 }}>{error}</T>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </View>
  );
}
