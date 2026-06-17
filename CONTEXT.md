# AthensGPS — Project Context

> Always-updating context file. Update after every major step.
> Last updated: 2026-06-17

## What this is

A rebuild of **AthensGPS** — a mobile app that shows **live Athens bus positions**
on an OpenStreetMap map, using the unofficial OASA telematics API. The previous
implementation (native Android, Kotlin + Jetpack Compose) was **deleted** and is
being **replaced** with:

- **Expo (React Native, TypeScript)** — Expo SDK 56, React 19, RN 0.85
- **Convex** — reactive backend; fetches OASA server-side, caches in tables, and
  pushes live updates to the client via reactive queries
- **Leaflet in a WebView** — free OpenStreetMap tiles, **no API key**, runs in
  Expo Go (chosen to honor the original "free OSM, no key" goal)

## Key decisions (confirmed with user)

- Map: **Leaflet in WebView** (not react-native-maps / MapLibre) → Expo Go works.
- Old Kotlin build: **deleted** (no backup kept).
- Convex: **Convex Cloud** (user logs in via `npx convex dev`).
- Node: system Node 18 was too old for Expo SDK 56 → installed **Node 20 (nvm)**
  at user level (non-destructive). Must `source ~/.nvm/nvm.sh` to use it.

## Architecture

```
Client (Expo / RN)  ──subscribe──▶  Convex queries  ◀──write──  Convex actions  ──HTTPS──▶  OASA API
   (WebView map)                     (reactive tables)            (server-side fetch)        telematics.oasa.gr
```

- The phone NEVER calls OASA directly. Actions fetch it server-side → this also
  fixes the old cleartext-HTTP problem (the phone only talks HTTPS to Convex).
- **Live buses** are reactive: client calls `refreshBuses` action every ~12s; the
  action writes the `buses` table; the subscribed `busesByRoute` query re-renders
  the map automatically.

## OASA API facts (verified 2026-06-17)

- Base: `https://telematics.oasa.gr/api/?act=<action>&p1=<param>` (GET).
- **MUST be HTTPS** — plain `http://` now returns an empty body (the old app's
  cleartext whitelist path is dead).
- Returns JSON arrays with `Content-Type: text/html` → parse via `res.json()`.
- Field names (quirky, preserved from old Kotlin models):
  - `webGetLines` → LineCode, LineID, LineDescr, LineDescrEng
  - `webGetRoutes` (p1=lineCode) → RouteCode, LineCode, RouteDescr, RouteDescrEng, RouteType, RouteDistance
  - `webGetStops` (p1=routeCode) → StopCode, StopID, StopDescr, StopDescrEng, StopLat, StopLng, RouteStopOrder
  - `webRouteDetails` (p1=routeCode) → routed_x (lng), routed_y (lat), routed_order
  - `getBusLocation` (p1=routeCode) → VEH_NO, CS_DATE, CS_LAT, CS_LNG, ROUTE_CODE
  - `getStopArrivals` (p1=stopCode) → route_code, veh_code, btime2 (minutes)

## Progress

- [x] Install Node 20 via nvm
- [x] Delete old Kotlin build, scaffold Expo app (blank-typescript)
- [x] Install deps: `convex@1.41.0`, `react-native-webview@13.16.1`
- [x] Convex backend written and **typechecks clean** (`tsc -p convex/tsconfig.json` → 0 errors)
  - `convex/schema.ts` — tables: lines, routes, stops, routePoints, buses (all indexed)
  - `convex/oasaApi.ts` — server-side OASA HTTPS client (defensive: failures → [])
  - `convex/transit.ts` — public queries, internal mutations (upsert/replace), public actions
  - `convex/_generated/*` — hand-authored to match `convex dev` output (so it builds pre-login)
  - `convex/tsconfig.json` — standard Convex TS config
- [x] React Native UI — **built & bundles clean** (Metro export: 651 modules, 0 errors)
  - `App.tsx` — ConvexProvider; renders a "configure me" screen if the env var is unset
  - `src/convex.ts` — `ConvexReactClient` from `process.env.EXPO_PUBLIC_CONVEX_URL`
  - `src/HomeScreen.tsx` — line search, direction chips, 12s live-bus polling, arrivals sheet
  - `src/TransitMap.tsx` — WebView host; bridges route/stops/buses ⇄ Leaflet (gated on "ready")
  - `src/leaflet.ts` — self-contained Leaflet/OSM HTML (CDN Leaflet, no API key)
- [x] Wire client to env var `EXPO_PUBLIC_CONVEX_URL` (`.env.example` added; `.env.local` is gitignored)
- [x] README with run instructions; both typechecks clean (app `tsc --noEmit` + convex → 0 errors)

## Remaining to actually see it live (needs the user)

1. `source ~/.nvm/nvm.sh && nvm use 20` (Node 18 won't run SDK 56)
2. `npx convex dev` → log in; this pushes functions + regenerates `convex/_generated`
3. `cp .env.example .env.local` and set `EXPO_PUBLIC_CONVEX_URL=` to the printed URL
4. `npx expo start` → open in Expo Go

## Convex function reference (for the client)

- Queries: `api.transit.listLines`, `routesByLine({lineCode})`,
  `stopsByRoute({routeCode})`, `pointsByRoute({routeCode})`, `busesByRoute({routeCode})`
- Actions: `api.transit.loadLines()`, `loadLine({lineCode})`,
  `loadRoute({routeCode})`, `refreshBuses({routeCode})`, `stopArrivals({stopCode})`

## How to run (once UI is done)

1. `source ~/.nvm/nvm.sh && nvm use 20`
2. `cd Test/AthensGPS`
3. `npx convex dev`  → log in (browser); this pushes functions + regenerates `_generated`
4. Copy the deployment URL it prints into `.env.local` as `EXPO_PUBLIC_CONVEX_URL=...`
5. In a second terminal: `npx expo start` → open in Expo Go (scan QR)

## Notes / ideas for later

- Live-bus refresh is currently client-driven (setInterval). Could move to a
  self-rescheduling Convex action / cron for fully server-driven polling.
- Could cache the line list with a TTL instead of refetching on each app open.
- "Center on my location" button (expo-location) — not yet added.
