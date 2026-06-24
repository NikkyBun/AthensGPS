import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

const ACCENT = "#1565c0";

/** First screen the app opens on: brand + the two entry points. */
export default function LandingScreen({
  onMap,
  onFavorites,
}: {
  onMap: () => void;
  onFavorites: () => void;
}) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.hero}>
        <Text style={styles.brand}>AthensGPS</Text>
        <Text style={styles.tagline}>Live Athens buses &amp; trolleys</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
          onPress={onMap}
        >
          <Text style={styles.btnIcon}>🗺️</Text>
          <Text style={styles.btnPrimaryText}>Map</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
          onPress={onFavorites}
        >
          <Text style={styles.btnIcon}>⭐</Text>
          <Text style={styles.btnSecondaryText}>Favorites</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  hero: { alignItems: "center", marginBottom: 48 },
  brand: { fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  tagline: { fontSize: 15, color: "#cfe3fb", marginTop: 6 },

  buttons: { width: "100%", maxWidth: 360, gap: 16 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  pressed: { opacity: 0.85 },
  btnIcon: { fontSize: 22 },
  btnPrimary: { backgroundColor: "#fff" },
  btnPrimaryText: { color: ACCENT, fontSize: 18, fontWeight: "800" },
  btnSecondary: { backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1.5, borderColor: "#fff" },
  btnSecondaryText: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
