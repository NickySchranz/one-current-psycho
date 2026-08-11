import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAppStore } from "@/stores/app-store";
import { Header } from "@/features/navigation/Header";
import { ClientListScreen } from "@/features/clients/ClientListScreen";
import { ClientSidebar } from "@/features/clients/ClientSidebar";
import { ClientDetailScreen } from "@/features/clients/ClientDetailScreen";
import { ShareScreen } from "@/features/share-view/ShareScreen";
import { ClientHistoryScreen } from "@/features/share-view/ClientHistoryScreen";
import { CalmNote, Hint } from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/** Sidebar + main pane from this width up; stacked navigation below it. */
const WIDE_BREAKPOINT = 900;

/** Wide layout, nothing selected: a calm prompt instead of a blank pane. */
function EmptyPane() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <CalmNote style={{ maxWidth: 420 }}>
        <Hint style={{ marginBottom: 0, textAlign: "center" }}>
          Select a client on the left to see their shared files and timelines.
        </Hint>
      </CalmNote>
    </View>
  );
}

function AppShell() {
  const ready = useAppStore((s) => s.ready);
  const view = useAppStore((s) => s.view);
  const init = useAppStore((s) => s.init);
  const tk = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return <View accessibilityState={{ busy: true }} style={{ flex: 1, backgroundColor: tk.bg }} />;
  }

  const main = (
    <>
      {view.kind === "client" && <ClientDetailScreen clientId={view.clientId} />}
      {view.kind === "share" && <ShareScreen clientId={view.clientId} shareId={view.shareId} />}
      {view.kind === "client-history" && <ClientHistoryScreen clientId={view.clientId} />}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tk.bg }}>
      <StatusBar style={tk.mode === "dark" ? "light" : "dark"} />
      <Header wide={wide} />
      {wide ? (
        <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
          <ClientSidebar />
          <View style={{ flex: 1, minWidth: 0 }}>
            {view.kind === "clients" ? <EmptyPane /> : main}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          {view.kind === "clients" ? <ClientListScreen /> : main}
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}
