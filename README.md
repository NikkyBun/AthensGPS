# AthensGPS

Live Athens bus & trolley positions on a free OpenStreetMap map.

A rebuild of the original native-Android AthensGPS as an **Expo (React Native)**
app backed by **Convex**. The phone never touches the (HTTP-flaky, key-less)
OASA telematics API directly — Convex fetches it server-side over HTTPS, caches
it in reactive tables, and live bus positions stream to the map automatically.

## Stack

- **Expo SDK 56** (React Native 0.85, React 19) — runs in **Expo Go**, no native build
- **Convex** — reactive backend: server-side OASA fetch, cache, live queries
- **Leaflet in a WebView** — OpenStreetMap tiles, **no API key**

```
Expo / RN client ──subscribe──▶ Convex queries ◀──write── Convex actions ──HTTPS──▶ OASA
   (Leaflet WebView)            (reactive tables)         (server-side fetch)   telematics.oasa.gr
```

The client calls `refreshBuses` every ~12s; the action rewrites the `buses`
table, and the subscribed `busesByRoute` query re-renders the map markers.

## Project layout

```
App.tsx                  ConvexProvider + "configure me" screen
src/convex.ts            ConvexReactClient from EXPO_PUBLIC_CONVEX_URL
src/HomeScreen.tsx       search, direction chips, live-bus polling, arrivals sheet
src/TransitMap.tsx       WebView host; bridges route/stop/bus data <-> Leaflet
src/leaflet.ts           the Leaflet/OSM HTML that runs inside the WebView
convex/schema.ts         tables: lines, routes, stops, routePoints, buses
convex/oasaApi.ts        server-side OASA HTTPS client (failures -> [])
convex/transit.ts        public queries, internal mutations, public actions
```

## Run it

Requires **Node 20+** (Expo SDK 56 won't run on Node 18). If you used nvm:
`source ~/.nvm/nvm.sh && nvm use 20`.

1. **Install** (already done in this repo): `npm install`
2. **Start Convex** — logs you in via the browser, pushes the functions, and
   regenerates `convex/_generated`:
   ```bash
   npx convex dev
   ```
   Leave it running. Copy the deployment URL it prints.
3. **Configure the client URL**:
   ```bash
   cp .env.example .env.local
   # edit .env.local → EXPO_PUBLIC_CONVEX_URL=https://<your>.convex.cloud
   ```
4. **Start Expo** in a second terminal and open in Expo Go (scan the QR):
   ```bash
   npx expo start
   ```

Pick a line, choose a direction, watch the buses move, and tap a stop for
arrival estimates.

## Typecheck

```bash
npx tsc --noEmit                       # the app (App.tsx + src/)
npx tsc -p convex/tsconfig.json --noEmit   # the Convex backend
```

## Notes

- The OASA API is undocumented and occasionally flaky; every backend fetch fails
  soft to an empty array, so the UI degrades to "no data" rather than crashing.
- Live-bus polling is currently client-driven (`setInterval`). It could move to a
  self-rescheduling Convex action / cron for fully server-driven updates.
