import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/stores/app-store";
import { alpha } from "@/ui/color";
import { Button, T } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/** App header: back navigation driven by the view, title, theme toggle. */
export function Header({ wide = false }: { wide?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const clients = useAppStore((s) => s.clients);

  const client =
    view.kind === "client" || view.kind === "share"
      ? clients.find((c) => c.id === view.clientId)
      : undefined;
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
      {view.kind !== "clients" && (!wide || view.kind === "share") && (
        <Button
          variant="quiet"
          label="← Back"
          onPress={() =>
            setView(
              view.kind === "share"
                ? { kind: "client", clientId: view.clientId }
                : { kind: "clients" },
            )
          }
        />
      )}
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
      <Button
        variant="quiet"
        accessibilityLabel="Switch theme"
        label={theme === "riverbed" ? "Dark" : "Light"}
        onPress={() => setTheme(theme === "riverbed" ? "duskwood" : "riverbed")}
      />
    </View>
  );
}
