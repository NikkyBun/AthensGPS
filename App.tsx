import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "convex/react";
import { convex } from "./src/convex";
import HomeScreen from "./src/HomeScreen";
import LandingScreen from "./src/LandingScreen";
import FavoritesScreen from "./src/FavoritesScreen";
import { FavoritesProvider, type FavoriteLine } from "./src/favorites";

type Screen = "landing" | "map" | "favorites";

export default function App() {
  // No EXPO_PUBLIC_CONVEX_URL configured → guide the user instead of crashing.
  if (!convex) return <ConfigNeeded />;

  return (
    <ConvexProvider client={convex}>
      <FavoritesProvider>
        <Root />
      </FavoritesProvider>
    </ConvexProvider>
  );
}

function Root() {
  const [screen, setScreen] = useState<Screen>("landing");
  // Set when the map is opened from a favorite, so HomeScreen preselects that line.
  const [pendingLine, setPendingLine] = useState<FavoriteLine | null>(null);

  // Open the map fresh (no preselected line) — from the landing/drawer "Map".
  const goMap = useCallback(() => {
    setPendingLine(null);
    setScreen("map");
  }, []);

  // Open the map with a line already selected — "searching" a favorite.
  const openLineOnMap = useCallback((line: FavoriteLine) => {
    setPendingLine(line);
    setScreen("map");
  }, []);

  if (screen === "landing") {
    return <LandingScreen onMap={goMap} onFavorites={() => setScreen("favorites")} />;
  }

  if (screen === "favorites") {
    return <FavoritesScreen onBack={() => setScreen("landing")} onPick={openLineOnMap} />;
  }

  return (
    <HomeScreen
      initialLine={pendingLine}
      onOpenFavorites={() => setScreen("favorites")}
      onGoMap={goMap}
    />
  );
}

function ConfigNeeded() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>AthensGPS isn't connected yet</Text>
      <Text style={styles.body}>
        Set <Text style={styles.code}>EXPO_PUBLIC_CONVEX_URL</Text> in{" "}
        <Text style={styles.code}>.env.local</Text> to your Convex deployment URL,
        then reload the app.
      </Text>
      <Text style={styles.body}>
        Run <Text style={styles.code}>npx convex dev</Text> to get the URL (see the
        README for the full steps).
      </Text>
      <Pressable
        style={styles.btn}
        onPress={() => Linking.openURL("https://docs.convex.dev/quickstart/react-native")}
      >
        <Text style={styles.btnText}>Convex setup docs</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1565c0", textAlign: "center" },
  body: { fontSize: 15, color: "#37474f", textAlign: "center", lineHeight: 21 },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#eceff1",
    color: "#102027",
  },
  btn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#1565c0",
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
