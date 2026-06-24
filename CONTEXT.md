# AthensGPS — Project Context

> Always-updating context file. Update after every major step.
> Last updated: 2026-06-17

## What this is

**AthensGPS** — a mobile app showing **live Athens bus/trolley positions** on an
OpenStreetMap map via the unofficial OASA telematics API. A rebuild of the old
native-Android (Kotlin) app, now **shipped** as an Expo app with a Convex backend.

- **Expo SDK 56** (React Native 0.85, React 19) — runs in Expo Go *and* as a standalone APK
- **Convex** — reactive backend: fetches OASA server-side, caches in tables, streams live buses
- **Leaflet in a WebView** — free OSM tiles, **no API key**

## Status: SHIPPED ✅

- Backend deployed to **production** Convex + seeded (474 lines verified live).
- Client verified on a real phone (Expo Go, then standalone APK).
- Code pushed to GitHub (private `NikkyBun/AthensGPS`, branch `main`).
- **Standalone Android APK** built via EAS (sideload distribution).
- **OTA updates** enabled (EAS Update) — JS changes ship without a rebuild.

## Architecture

```
Client (Expo / RN)  ──subscribe──▶  Convex queries  ◀──write──  Convex actions  ──HTTPS──▶  OASA API
   (Leaflet WebView)                 (reactive tables)           (server-side fetch)       telematics.oasa.gr
```

- Phone NEVER calls OASA directly (fixes old cleartext-HTTP issue; phone only talks HTTPS/WSS to Convex).
- Live buses: client calls `refreshBuses` every ~12s (`BUS_REFRESH_MS` in `src/HomeScreen.tsx`);
  action rewrites `buses` table; subscribed `busesByRoute` query re-renders markers.
  **Per-phone polling** (not server-driven) — deliberate tradeoff, fine for small user counts.

## Files

```
App.tsx              ConvexProvider + FavoritesProvider + screen router (landing/map/favorites)
src/LandingScreen.tsx  first screen: brand + "Map" and "Favorites" buttons
src/FavoritesScreen.tsx  saved-line list; tap a row = open it on the map (= search it), tap ★ = remove
src/SideMenu.tsx     left slide-in drawer (Map / Favorites), opened by the map's top-left ← button
src/favorites.tsx    FavoritesProvider + useFavorites; persists via AsyncStorage if present, else in-memory
src/Star.tsx         gold ☆ outline / ★ filled toggle
src/convex.ts        ConvexReactClient from EXPO_PUBLIC_CONVEX_URL (strips trailing slash!)
src/HomeScreen.tsx   map screen: top-left menu button, search, direction chips, BUS_REFRESH_MS polling,
                     arrivals sheet, ★ favorite toggle (in line header + search rows)
src/TransitMap.tsx   WebView host; bridges route/stops/buses ⇄ Leaflet (gated on "ready")
src/leaflet.ts       Leaflet/OSM HTML; stops have a 16px invisible tap target
convex/schema.ts     tables: lines, routes, stops, routePoints, buses (indexed)
convex/oasaApi.ts    server-side OASA HTTPS client (failures → [])
convex/transit.ts    queries, internal mutations, actions
eas.json             EAS build (preview=APK, prod URL baked in) + update channels
```

## Navigation & favorites (added 2026-06-19)

- App opens on **LandingScreen** → "Map" or "Favorites". The map has a top-left **←** button
  opening **SideMenu** (Map / Favorites). Favorites = saved **lines** ({lineCode, lineId, descr});
  opening one preselects that line on the map via HomeScreen's `initialLine` prop.
- Screens are switched by simple state in `App.tsx` (no nav library); changing screen remounts
  HomeScreen (map reloads — acceptable).
- **`@react-native-async-storage/async-storage` is a NEW native module.** Favorites persist in
  Expo Go and in any *fresh* `eas build`, but the previously distributed APK didn't bundle it, so
  favorites there fall back to in-memory (no crash — the require is wrapped in try/catch). To ship
  persistence to installed users, a native rebuild is required (this is NOT OTA-able).

## Cloud coordinates

(`.env.local` is gitignored so not in the repo.)
- **Convex prod**: `incredible-dachshund-156` → https://incredible-dachshund-156.convex.cloud (APK points here, seeded)
- **Convex dev**: `uncommon-ermine-9` (`npx convex dev`)
- **Expo/EAS**: account `nikkyfolfy`, projectId `07ab6e7e-3106-4d61-99df-b09c1e15020c`
- **GitHub**: private `NikkyBun/AthensGPS` (branch `main`); commits as NikkyBun <nikoshena1993@gmail.com>

## OASA API facts (verified 2026-06-17)

- Base: `https://telematics.oasa.gr/api/?act=<action>&p1=<param>` (GET).
- **MUST be HTTPS** — plain http:// returns an empty body.
- JSON arrays served with `Content-Type: text/html` → parse via `res.json()`.
- Field names (quirky, from old Kotlin models):
  - `webGetLines` → LineCode, LineID, LineDescr, LineDescrEng
  - `webGetRoutes` (p1=lineCode) → RouteCode, LineCode, RouteDescr, RouteDescrEng, RouteType, RouteDistance
  - `webGetStops` (p1=routeCode) → StopCode, StopID, StopDescr, StopDescrEng, StopLat, StopLng, RouteStopOrder
  - `webRouteDetails` (p1=routeCode) → routed_x (lng), routed_y (lat), routed_order
  - `getBusLocation` (p1=routeCode) → VEH_NO, CS_DATE, CS_LAT, CS_LNG, ROUTE_CODE
  - `getStopArrivals` (p1=stopCode) → route_code, veh_code, btime2 (minutes)

## Convex function reference (for the client)

- Queries: `api.transit.listLines`, `routesByLine({lineCode})`,
  `stopsByRoute({routeCode})`, `pointsByRoute({routeCode})`, `busesByRoute({routeCode})`
- Actions: `loadLines()`, `loadLine({lineCode})`, `loadRoute({routeCode})`,
  `refreshBuses({routeCode})`, `stopArrivals({stopCode})`

## Build & update workflow

Prereq: `source ~/.nvm/nvm.sh && nvm use 20` (SDK 56 needs Node 20+). Machine is logged into Expo (`nikkyfolfy`).

- **JS/UI/logic change** (`App.tsx`, `src/*`): `eas update --channel preview --message "..."`
  → OTA, no rebuild. Keep `version` = 1.0.0 (runtimeVersion policy = appVersion).
- **Backend change** (`convex/*`): `npx convex deploy` → live for all users.
- **Native change / raise version**: bump `versionCode`, `eas build -p android --profile preview`, reshare APK.
- First distributed APK (`versionCode` 1) predates expo-updates → users must install the
  OTA-enabled build (`versionCode` 2) once to start receiving OTA.

## Local dev run (Expo Go)

1. `source ~/.nvm/nvm.sh && nvm use 20`
2. `npx convex dev` (dev deployment; leave running)
3. `npx expo start` → scan QR in Expo Go (use `--tunnel` if phone is on a different network; needs `@expo/ngrok`, installed)

## Gotchas / notes

- **Convex URL trailing slash** breaks the WS handshake (404 → stuck "Loading lines…"). `src/convex.ts` strips it.
- Convex prod serves independently of `npx convex dev`.
- Web target deps (react-dom, react-native-web) NOT installed → no `expo start --web`.
- Expo artifact APK links expire (~30 days) — re-download from the build page or rehost for durable sharing.
- Ideas for later: server-driven (cron) bus polling for scale; line-list TTL cache;
  "center on my location" (expo-location); Play Store (AAB) track.
