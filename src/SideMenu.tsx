import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ACCENT = "#1565c0";
const TOP_INSET = Platform.OS === "ios" ? 50 : RNStatusBar.currentHeight ?? 24;
const WIDTH = 270;

type Props = {
  visible: boolean;
  onClose: () => void;
  onMap: () => void;
  onFavorites: () => void;
};

/** Left slide-in drawer with the same two destinations as the landing screen.
 *  Stays mounted so it can animate both in and out; ignores touches when hidden. */
export default function SideMenu({ visible, onClose, onMap, onFavorites }: Props) {
  const tx = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx, {
        toValue: visible ? 0 : -WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, tx, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View
        style={[styles.backdrop, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX: tx }] }]}>
        <Text style={styles.brand}>AthensGPS</Text>

        <MenuItem icon="🗺️" label="Map" onPress={onMap} />
        <MenuItem icon="⭐" label="Favorites" onPress={onFavorites} />
      </Animated.View>
    </View>
  );
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
    >
      <Text style={styles.itemIcon}>{icon}</Text>
      <Text style={styles.itemLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: "#fff",
    paddingTop: TOP_INSET + 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    elevation: 16,
  },
  brand: { fontSize: 22, fontWeight: "900", color: ACCENT, marginBottom: 22, paddingHorizontal: 4 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  itemPressed: { backgroundColor: "#e3f2fd" },
  itemIcon: { fontSize: 22, width: 28, textAlign: "center" },
  itemLabel: { fontSize: 17, fontWeight: "700", color: "#102027" },
});
