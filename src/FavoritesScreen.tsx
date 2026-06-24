import {
  FlatList,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFavorites, type FavoriteLine } from "./favorites";
import Star from "./Star";

const ACCENT = "#1565c0";
const TOP_INSET = Platform.OS === "ios" ? 50 : RNStatusBar.currentHeight ?? 24;

/** List of saved lines. Tapping a row opens it on the map (= search it);
 *  tapping its star removes it. */
export default function FavoritesScreen({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (line: FavoriteLine) => void;
}) {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <View style={[styles.root, { paddingTop: TOP_INSET + 8 }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Favorites</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyStar}>☆</Text>
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptyHint}>
            Open a line on the map and tap its ☆ to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(f) => f.lineCode}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onPick(item)}
            >
              <View style={styles.rowBadge}>
                <Text style={styles.rowBadgeText}>{item.lineId}</Text>
              </View>
              <Text style={styles.rowDescr} numberOfLines={1}>
                {item.descr || `Line ${item.lineId}`}
              </Text>
              <Star filled onPress={() => removeFavorite(item.lineCode)} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f7f9", paddingHorizontal: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backIcon: { fontSize: 22, color: ACCENT, fontWeight: "800", marginTop: -2 },
  title: { fontSize: 24, fontWeight: "900", color: "#102027" },

  list: { paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  rowPressed: { opacity: 0.7 },
  rowBadge: {
    minWidth: 46,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    marginRight: 10,
  },
  rowBadgeText: { color: ACCENT, fontWeight: "800" },
  rowDescr: { flex: 1, color: "#37474f", fontSize: 14, marginRight: 8 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60, gap: 8 },
  emptyStar: { fontSize: 48, color: "#cfd8dc" },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#546e7a" },
  emptyHint: { fontSize: 14, color: "#90a4ae", textAlign: "center", paddingHorizontal: 30 },
});
