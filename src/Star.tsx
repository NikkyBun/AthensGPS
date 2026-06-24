import { Pressable, StyleSheet, Text } from "react-native";

/** Favorite gold. Outline (☆) when not saved, filled (★) when saved. */
export const STAR_GOLD = "#f5b301";

export default function Star({
  filled,
  onPress,
  size = 22,
}: {
  filled: boolean;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable hitSlop={10} onPress={onPress} style={styles.btn} accessibilityRole="button">
      <Text style={[styles.glyph, { fontSize: size }]}>{filled ? "★" : "☆"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 4, paddingVertical: 2 },
  glyph: { color: STAR_GOLD, fontWeight: "900", lineHeight: 26 },
});
