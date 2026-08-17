import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/stores/app-store";
import { alpha } from "@/ui/color";
import { Button, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";
import { Logo } from "./Logo";

/** App header: back navigation driven by the view, title, theme toggle. */
export function Header({ wide = false }: { wide?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const clients = useAppStore((s) => s.clients);
  const logout = useAppStore((s) => s.logout);
  const lastLoginMode = useAppStore((s) => s.lastLoginMode);
  const inboxCount = useAppStore((s) => s.inbox.length);

  const client =
    view.kind !== "clients" ? clients.find((c) => c.id === view.clientId) : undefined;
  const title =
    view.kind === "clients"
      ? "One Current — Practice"
      : (client?.name ?? "One Current — Practice");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingTop: 8 + insets.top,
        paddingBottom: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: alpha(t.lineAxis, 0.55),
        backgroundColor: alpha(t.bgRaised, 0.82),
      }}
    >
      {/* Wide screens keep the client list on-screen — back only unwinds a share. */}
      {view.kind !== "clients" && (!wide || view.kind !== "client") && (
        <Button
          variant="quiet"
          label="← Back"
          onPress={() =>
            setView(
              view.kind === "share" || view.kind === "client-history"
                ? { kind: "client", clientId: view.clientId }
                : { kind: "clients" },
            )
          }
        />
      )}
      {view.kind === "clients" && <Logo size={18} />}
      <T
        numberOfLines={1}
        style={{
          fontSize: 16.8,
          fontWeight: "600",
          letterSpacing: 0.17,
          marginRight: "auto",
          flexShrink: 1,
        }}
      >
        {title}
      </T>
      {inboxCount > 0 && view.kind !== "clients" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${inboxCount} incoming ${inboxCount === 1 ? "share" : "shares"}`}
          onPress={() => setView({ kind: "clients" })}
          style={{
            borderWidth: 1,
            borderColor: alpha(t.accent, 0.6),
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <T style={{ fontSize: 11.5, color: t.accent }}>{inboxCount} incoming</T>
        </Pressable>
      )}
      {lastLoginMode === "local" && (
        <T
          style={{
            fontSize: 11.5,
            color: t.inkSoft,
            borderWidth: 1,
            borderColor: alpha(t.lineAxis, 0.55),
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
            overflow: "hidden",
          }}
        >
          Offline
        </T>
      )}
      <Button
        variant="quiet"
        accessibilityLabel="Switch theme"
        label={theme === "riverbed" ? "Dark" : "Light"}
        onPress={() => setTheme(theme === "riverbed" ? "duskwood" : "riverbed")}
      />
      <Button variant="quiet" label="Sign out" onPress={() => void logout()} />
    </View>
  );
}
