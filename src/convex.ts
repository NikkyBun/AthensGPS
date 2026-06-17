import { ConvexReactClient } from "convex/react";

/**
 * The phone talks to exactly one server: our Convex deployment (over HTTPS/WSS).
 * The URL is injected at build time from `.env.local` — see README.
 *
 * Must be plain static dot-notation so Expo can inline it into the bundle
 * (`process.env["..."]` would NOT be replaced). If it is missing we export a
 * null client and App.tsx renders a "configure me" screen instead of crashing.
 */
// Convex builds its WebSocket path as `${url}/api/.../sync`, so a trailing
// slash on the address yields `…convex.cloud//api/…` → 404 handshake → the app
// hangs on "Loading lines…". Strip any trailing slash(es) defensively.
export const convexUrl: string = (process.env.EXPO_PUBLIC_CONVEX_URL ?? "").replace(/\/+$/, "");

export const convex: ConvexReactClient | null = convexUrl
  ? new ConvexReactClient(convexUrl)
  : null;
