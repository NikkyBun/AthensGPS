import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { LEAFLET_HTML } from "./leaflet";

export type LatLng = { lat: number; lng: number };
export type StopMarker = { stopCode: string; descr: string; lat: number; lng: number };
export type BusMarker = { vehicleNo: string; lat: number; lng: number };

type Props = {
  points: LatLng[];
  stops: StopMarker[];
  buses: BusMarker[];
  onStopPress: (stop: { stopCode: string; descr: string }) => void;
};

/**
 * Leaflet/OSM map in a WebView. Route geometry and stops are injected whenever
 * they change (which also re-frames the map); live buses are injected on their
 * own so the ~12s refresh never yanks the viewport around.
 *
 * Injection is gated on the page's "ready" message — until Leaflet has loaded,
 * `window.renderRoute` doesn't exist. We stash the latest payloads in refs and
 * (re)inject both on ready and on every data change.
 */
export default function TransitMap({ points, stops, buses, onStopPress }: Props) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const points_ = useRef(points);
  const stops_ = useRef(stops);
  const buses_ = useRef(buses);
  points_.current = points;
  stops_.current = stops;
  buses_.current = buses;

  const injectRoute = useCallback(() => {
    if (!readyRef.current) return;
    const js = `window.renderRoute(${JSON.stringify(points_.current)}, ${JSON.stringify(
      stops_.current,
    )}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  const injectBuses = useCallback(() => {
    if (!readyRef.current) return;
    const js = `window.renderBuses(${JSON.stringify(buses_.current)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  useEffect(injectRoute, [points, stops, injectRoute]);
  useEffect(injectBuses, [buses, injectBuses]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      if (__DEV__) console.log("[TransitMap] message:", e.nativeEvent.data);
      let msg: { type?: string; stopCode?: string; descr?: string };
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (msg.type === "ready") {
        readyRef.current = true;
        injectRoute();
        injectBuses();
      } else if (msg.type === "stop" && msg.stopCode) {
        onStopPress({ stopCode: msg.stopCode, descr: msg.descr ?? "" });
      }
    },
    [injectRoute, injectBuses, onStopPress],
  );

  return (
    <WebView
      ref={webRef}
      style={styles.web}
      originWhitelist={["*"]}
      source={{ html: LEAFLET_HTML }}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      // The map fills the screen and never scrolls as a document.
      scrollEnabled={false}
      overScrollMode="never"
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#e8eef2" },
});
