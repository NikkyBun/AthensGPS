/**
 * Self-contained HTML for the Leaflet map that runs inside the WebView.
 *
 * Free OpenStreetMap tiles, no API key (the whole point of the rebuild).
 * Leaflet itself is loaded from the unpkg CDN — the device already needs
 * internet for tiles and for talking to Convex, so this adds no new constraint.
 *
 * Bridge contract with the React Native side (TransitMap.tsx):
 *   RN  -> page:  window.renderRoute(points, stops)   draw polyline + stop dots, fit bounds
 *                 window.renderBuses(buses)            redraw live vehicles (no re-fit)
 *   page -> RN:   postMessage({ type: "ready" })       map is initialised, safe to inject
 *                 postMessage({ type: "stop", stopCode, descr })  a stop dot was tapped
 *
 * `points`/`stops`/`buses` are passed as already-stringified JSON to keep the
 * injected snippet trivial to build on the RN side.
 */
export const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8eef2; }
    .bus-icon {
      background: #1565c0; color: #fff; border: 2px solid #fff;
      border-radius: 50%; width: 26px; height: 26px; line-height: 22px;
      text-align: center; font: 700 11px/22px -apple-system, Roboto, sans-serif;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var post = function (msg) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      };

      // Athens, roughly Syntagma, as the default view.
      var map = L.map("map", { zoomControl: true, attributionControl: false })
        .setView([37.9838, 23.7275], 12);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      var routeLayer = L.layerGroup().addTo(map);
      var stopLayer = L.layerGroup().addTo(map);
      var busLayer = L.layerGroup().addTo(map);

      // Draw the route polyline + ordered stop markers, then frame them.
      window.renderRoute = function (points, stops) {
        routeLayer.clearLayers();
        stopLayer.clearLayers();
        var latlngs = points.map(function (p) { return [p.lat, p.lng]; });
        if (latlngs.length > 1) {
          L.polyline(latlngs, { color: "#1565c0", weight: 4, opacity: 0.85 })
            .addTo(routeLayer);
        }
        stops.forEach(function (s) {
          // Visible dot — non-interactive so it never blocks the tap target.
          L.circleMarker([s.lat, s.lng], {
            radius: 6, color: "#0d3b66", weight: 2,
            fillColor: "#ffffff", fillOpacity: 1, interactive: false,
          }).addTo(stopLayer);
          // Larger, ~invisible ring that is the actual finger target (a 5px dot
          // is nearly impossible to tap). fillOpacity 0.01 keeps it painted so
          // it still receives touch events.
          var hit = L.circleMarker([s.lat, s.lng], {
            radius: 16, weight: 0, fillColor: "#000000", fillOpacity: 0.01,
          }).addTo(stopLayer);
          hit.on("click", function () {
            post({ type: "stop", stopCode: s.stopCode, descr: s.descr });
          });
        });
        var all = latlngs.concat(stops.map(function (s) { return [s.lat, s.lng]; }));
        if (all.length) {
          map.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 16 });
        }
      };

      // Redraw live vehicles. Bus refreshes must NOT re-frame the map.
      window.renderBuses = function (buses) {
        busLayer.clearLayers();
        buses.forEach(function (b) {
          var icon = L.divIcon({
            className: "",
            html: '<div class="bus-icon">' + (b.vehicleNo || "") + "</div>",
            iconSize: [26, 26], iconAnchor: [13, 13],
          });
          L.marker([b.lat, b.lng], { icon: icon }).addTo(busLayer);
        });
      };

      post({ type: "ready" });
    })();
  </script>
</body>
</html>`;
