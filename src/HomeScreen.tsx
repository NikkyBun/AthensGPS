import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { OasaArrival } from "../convex/oasaApi";
import TransitMap from "./TransitMap";
import SideMenu from "./SideMenu";
import Star from "./Star";
import { useFavorites, type FavoriteLine } from "./favorites";

const TOP_INSET =
  Platform.OS === "ios" ? 50 : RNStatusBar.currentHeight ?? 24;

const ACCENT = "#1565c0";

/** How often live bus positions refresh, in milliseconds. Edit this to change
 *  how often the map updates the buses (e.g. 5000 = every 5s). */
const BUS_REFRESH_MS = 12_000;

type SelectedLine = { lineCode: string; lineId: string; descr: string };
type SelectedStop = { stopCode: string; descr: string };

type HomeScreenProps = {
  /** When the map is opened from a favorite, the line to preselect. */
  initialLine?: FavoriteLine | null;
  onOpenFavorites: () => void;
  onGoMap: () => void;
};

export default function HomeScreen({ initialLine, onOpenFavorites, onGoMap }: HomeScreenProps) {
  const [search, setSearch] = useState("");
  // Preselect the favorite's line on mount (the parent remounts this screen per
  // navigation, so reading initialLine once here is enough).
  const [selectedLine, setSelectedLine] = useState<SelectedLine | null>(initialLine ?? null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<SelectedStop | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { isFavorite, toggleFavorite } = useFavorites();

  /* --- reactive data (subscriptions; "skip" until we have a key) --- */
  const linesQ = useQuery(api.transit.listLines);
  const routesQ = useQuery(
    api.transit.routesByLine,
    selectedLine ? { lineCode: selectedLine.lineCode } : "skip",
  );
  const stopsQ = useQuery(
    api.transit.stopsByRoute,
    selectedRoute ? { routeCode: selectedRoute } : "skip",
  );
  const pointsQ = useQuery(
    api.transit.pointsByRoute,
    selectedRoute ? { routeCode: selectedRoute } : "skip",
  );
  const busesQ = useQuery(
    api.transit.busesByRoute,
    selectedRoute ? { routeCode: selectedRoute } : "skip",
  );

  /* --- server-side loaders/refreshers (actions) --- */
  const loadLines = useAction(api.transit.loadLines);
  const loadLine = useAction(api.transit.loadLine);
  const loadRoute = useAction(api.transit.loadRoute);
  const refreshBuses = useAction(api.transit.refreshBuses);
  const stopArrivals = useAction(api.transit.stopArrivals);

  // Populate the line list once on open.
  useEffect(() => {
    loadLines().catch(() => {});
  }, [loadLines]);

  // When a line is picked, fetch its directions.
  useEffect(() => {
    if (selectedLine) loadLine({ lineCode: selectedLine.lineCode }).catch(() => {});
  }, [selectedLine, loadLine]);

  // Default to the first direction once a line's routes arrive.
  useEffect(() => {
    if (selectedRoute === null && routesQ && routesQ.length > 0) {
      setSelectedRoute(routesQ[0].routeCode);
    }
  }, [routesQ, selectedRoute]);

  // Load a route's stops/path, then poll its live buses every ~12s.
  useEffect(() => {
    if (!selectedRoute) return;
    const route = selectedRoute;
    loadRoute({ routeCode: route }).catch(() => {});
    refreshBuses({ routeCode: route }).catch(() => {});
    const id = setInterval(() => {
      refreshBuses({ routeCode: route }).catch(() => {});
    }, BUS_REFRESH_MS);
    return () => clearInterval(id);
  }, [selectedRoute, loadRoute, refreshBuses]);

  /* --- map payloads (memoised so bus refreshes don't re-frame the map) --- */
  const mapPoints = useMemo(
    () => (pointsQ ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
    [pointsQ],
  );
  const mapStops = useMemo(
    () =>
      (stopsQ ?? []).map((s) => ({
        stopCode: s.stopCode,
        descr: s.descr || s.descrEng,
        lat: s.lat,
        lng: s.lng,
      })),
    [stopsQ],
  );
  const mapBuses = useMemo(
    () => (busesQ ?? []).map((b) => ({ vehicleNo: b.vehicleNo, lat: b.lat, lng: b.lng })),
    [busesQ],
  );

  /* --- line search results --- */
  const filteredLines = useMemo(() => {
    const all = linesQ ?? [];
    const q = search.trim().toLowerCase();
    const matches = q
      ? all.filter(
          (l) =>
            l.lineId.toLowerCase().includes(q) ||
            l.descr.toLowerCase().includes(q) ||
            l.descrEng.toLowerCase().includes(q),
        )
      : all;
    return matches.slice(0, 80);
  }, [linesQ, search]);

  const pickLine = useCallback((l: SelectedLine) => {
    setSelectedLine(l);
    setSelectedRoute(null);
    setSelectedStop(null);
    setSearch("");
  }, []);

  const pickRoute = useCallback((routeCode: string) => {
    setSelectedRoute(routeCode);
    setSelectedStop(null);
  }, []);

  const changeLine = useCallback(() => {
    setSelectedLine(null);
    setSelectedRoute(null);
    setSelectedStop(null);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.mapWrap}>
        <TransitMap
          points={mapPoints}
          stops={mapStops}
          buses={mapBuses}
          onStopPress={setSelectedStop}
        />
      </View>

      {/* Top overlay: menu button, then the search panel or active-line header. */}
      <View style={[styles.topOverlay, { paddingTop: TOP_INSET + 8 }]} pointerEvents="box-none">
        <Pressable style={styles.menuBtn} onPress={() => setMenuOpen(true)} hitSlop={6}>
          <Text style={styles.menuIcon}>←</Text>
        </Pressable>

        {!selectedLine ? (
          <SearchPanel
            search={search}
            onSearch={setSearch}
            lines={filteredLines}
            loading={linesQ === undefined}
            onPick={pickLine}
            onRetry={() => loadLines().catch(() => {})}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
          />
        ) : (
          <View style={styles.card}>
            <View style={styles.lineHeader}>
              <View style={styles.lineBadge}>
                <Text style={styles.lineBadgeText}>{selectedLine.lineId}</Text>
              </View>
              <Text style={styles.lineDescr} numberOfLines={1}>
                {selectedLine.descr}
              </Text>
              <Star
                filled={isFavorite(selectedLine.lineCode)}
                onPress={() => toggleFavorite(selectedLine)}
              />
              <Pressable hitSlop={8} onPress={changeLine}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {(routesQ ?? []).map((r) => {
                const active = r.routeCode === selectedRoute;
                return (
                  <Pressable
                    key={r.routeCode}
                    onPress={() => pickRoute(r.routeCode)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {r.descr || r.descrEng || `Route ${r.routeCode}`}
                    </Text>
                  </Pressable>
                );
              })}
              {routesQ === undefined && <ActivityIndicator color={ACCENT} style={styles.chipSpinner} />}
            </ScrollView>

            <Text style={styles.liveLine}>
              {mapBuses.length} bus{mapBuses.length === 1 ? "" : "es"} live · tap a stop for arrivals
            </Text>
          </View>
        )}
      </View>

      {selectedStop && (
        <ArrivalsSheet
          stop={selectedStop}
          fetchArrivals={stopArrivals}
          onClose={() => setSelectedStop(null)}
        />
      )}

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onMap={() => {
          setMenuOpen(false);
          onGoMap();
        }}
        onFavorites={() => {
          setMenuOpen(false);
          onOpenFavorites();
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */

type SearchPanelProps = {
  search: string;
  onSearch: (s: string) => void;
  lines: ReadonlyArray<{ _id: string; lineCode: string; lineId: string; descr: string; descrEng: string }>;
  loading: boolean;
  onPick: (l: SelectedLine) => void;
  onRetry: () => void;
  isFavorite: (lineCode: string) => boolean;
  toggleFavorite: (line: FavoriteLine) => void;
};

function SearchPanel({
  search,
  onSearch,
  lines,
  loading,
  onPick,
  onRetry,
  isFavorite,
  toggleFavorite,
}: SearchPanelProps) {
  return (
    <View style={[styles.card, styles.searchCard]}>
      <Text style={styles.title}>AthensGPS</Text>
      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder="Search a bus/trolley line…"
        placeholderTextColor="#90a4ae"
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={ACCENT} />
          <Text style={styles.muted}>Loading lines…</Text>
        </View>
      ) : lines.length === 0 ? (
        <View style={styles.centerCol}>
          <Text style={styles.muted}>No lines found.</Text>
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={lines}
          keyExtractor={(l) => l._id}
          keyboardShouldPersistTaps="handled"
          style={styles.results}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                onPick({ lineCode: item.lineCode, lineId: item.lineId, descr: item.descr })
              }
            >
              <View style={styles.rowBadge}>
                <Text style={styles.rowBadgeText}>{item.lineId}</Text>
              </View>
              <Text style={styles.rowDescr} numberOfLines={1}>
                {item.descr || item.descrEng}
              </Text>
              <Star
                filled={isFavorite(item.lineCode)}
                size={20}
                onPress={() =>
                  toggleFavorite({
                    lineCode: item.lineCode,
                    lineId: item.lineId,
                    descr: item.descr || item.descrEng,
                  })
                }
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */

type ArrivalsSheetProps = {
  stop: SelectedStop;
  fetchArrivals: (args: { stopCode: string }) => Promise<OasaArrival[]>;
  onClose: () => void;
};

function ArrivalsSheet({ stop, fetchArrivals, onClose }: ArrivalsSheetProps) {
  const [arrivals, setArrivals] = useState<OasaArrival[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setArrivals(await fetchArrivals({ stopCode: stop.stopCode }));
    } catch {
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, [fetchArrivals, stop.stopCode]);

  useEffect(() => {
    setArrivals(null);
    load();
  }, [load]);

  const valid = (arrivals ?? []).filter((a) => a.minutes < 1000);

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {stop.descr || `Stop ${stop.stopCode}`}
        </Text>
        <Pressable hitSlop={10} onPress={onClose}>
          <Text style={styles.sheetClose}>✕</Text>
        </Pressable>
      </View>

      {loading && arrivals === null ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={ACCENT} />
          <Text style={styles.muted}>Loading arrivals…</Text>
        </View>
      ) : valid.length === 0 ? (
        <Text style={styles.muted}>No upcoming arrivals reported.</Text>
      ) : (
        valid.map((a, i) => (
          <View key={`${a.vehicleCode}-${i}`} style={styles.arrivalRow}>
            <Text style={styles.arrivalRoute}>Route {a.routeCode}</Text>
            <Text style={styles.arrivalMin}>
              {a.minutes <= 0 ? "due" : `${a.minutes} min`}
            </Text>
          </View>
        ))
      )}

      <Pressable onPress={load} style={styles.refreshBtn} disabled={loading}>
        <Text style={styles.refreshText}>{loading ? "Refreshing…" : "Refresh"}</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e8eef2" },
  mapWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },

  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 10 },

  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  menuIcon: { fontSize: 22, color: ACCENT, fontWeight: "800", marginTop: -2 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchCard: { maxHeight: 420 },

  title: { fontSize: 20, fontWeight: "800", color: ACCENT, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#102027",
  },
  results: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
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
  rowDescr: { flex: 1, color: "#37474f", fontSize: 14 },

  lineHeader: { flexDirection: "row", alignItems: "center" },
  lineBadge: {
    minWidth: 46,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: "center",
    marginRight: 10,
  },
  lineBadgeText: { color: "#fff", fontWeight: "800" },
  lineDescr: { flex: 1, color: "#102027", fontSize: 15, fontWeight: "600" },
  changeLink: { color: ACCENT, fontWeight: "700", marginLeft: 8 },

  chips: { paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#eceff1",
    maxWidth: 240,
  },
  chipActive: { backgroundColor: ACCENT },
  chipText: { color: "#455a64", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  chipSpinner: { marginVertical: 7, marginHorizontal: 10 },

  liveLine: { color: "#607d8b", fontSize: 12 },

  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  centerCol: { alignItems: "center", paddingVertical: 12, gap: 8 },
  muted: { color: "#607d8b", fontSize: 14 },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: ACCENT,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 18,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#102027" },
  sheetClose: { fontSize: 18, color: "#607d8b", paddingHorizontal: 4 },
  arrivalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eceff1",
  },
  arrivalRoute: { color: "#37474f", fontSize: 14 },
  arrivalMin: { color: ACCENT, fontSize: 15, fontWeight: "800" },
  refreshBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#e3f2fd",
    borderRadius: 10,
  },
  refreshText: { color: ACCENT, fontWeight: "700" },
});
