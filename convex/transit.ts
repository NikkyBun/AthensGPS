import { query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import * as oasa from "./oasaApi";

/* ------------------------------------------------------------------ *
 * Public queries — the client subscribes to these. They are reactive:
 * when an action writes new rows, every subscribed client re-renders.
 * ------------------------------------------------------------------ */

export const listLines = query({
  args: {},
  handler: async (ctx) => {
    const lines = await ctx.db.query("lines").collect();
    // Sort by the public number, naturally (so "9" < "10").
    return lines.sort((a, b) =>
      a.lineId.localeCompare(b.lineId, undefined, { numeric: true }),
    );
  },
});

export const routesByLine = query({
  args: { lineCode: v.string() },
  handler: async (ctx, { lineCode }) =>
    ctx.db
      .query("routes")
      .withIndex("by_line", (q) => q.eq("lineCode", lineCode))
      .collect(),
});

export const stopsByRoute = query({
  args: { routeCode: v.string() },
  handler: async (ctx, { routeCode }) => {
    const stops = await ctx.db
      .query("stops")
      .withIndex("by_route", (q) => q.eq("routeCode", routeCode))
      .collect();
    return stops.sort((a, b) => a.order - b.order);
  },
});

export const pointsByRoute = query({
  args: { routeCode: v.string() },
  handler: async (ctx, { routeCode }) => {
    const pts = await ctx.db
      .query("routePoints")
      .withIndex("by_route", (q) => q.eq("routeCode", routeCode))
      .collect();
    return pts.sort((a, b) => a.order - b.order);
  },
});

export const busesByRoute = query({
  args: { routeCode: v.string() },
  handler: async (ctx, { routeCode }) =>
    ctx.db
      .query("buses")
      .withIndex("by_route", (q) => q.eq("routeCode", routeCode))
      .collect(),
});

/* ------------------------------------------------------------------ *
 * Internal mutations — only callable from actions, never the client.
 * They write the data fetched from OASA into the tables.
 * ------------------------------------------------------------------ */

const lineFields = {
  lineCode: v.string(),
  lineId: v.string(),
  descr: v.string(),
  descrEng: v.string(),
};
const routeFields = {
  routeCode: v.string(),
  lineCode: v.string(),
  descr: v.string(),
  descrEng: v.string(),
  type: v.string(),
  distance: v.string(),
};
const stopFields = {
  routeCode: v.string(),
  stopCode: v.string(),
  stopId: v.string(),
  descr: v.string(),
  descrEng: v.string(),
  lat: v.number(),
  lng: v.number(),
  order: v.number(),
};
const pointFields = {
  routeCode: v.string(),
  lat: v.number(),
  lng: v.number(),
  order: v.number(),
};
const busFields = {
  routeCode: v.string(),
  vehicleNo: v.string(),
  lat: v.number(),
  lng: v.number(),
  timestamp: v.string(),
};

export const upsertLines = internalMutation({
  args: { lines: v.array(v.object(lineFields)) },
  handler: async (ctx, { lines }) => {
    for (const l of lines) {
      const existing = await ctx.db
        .query("lines")
        .withIndex("by_code", (q) => q.eq("lineCode", l.lineCode))
        .first();
      if (existing) await ctx.db.patch(existing._id, l);
      else await ctx.db.insert("lines", l);
    }
  },
});

export const upsertRoutes = internalMutation({
  args: { routes: v.array(v.object(routeFields)) },
  handler: async (ctx, { routes }) => {
    for (const r of routes) {
      const existing = await ctx.db
        .query("routes")
        .withIndex("by_code", (q) => q.eq("routeCode", r.routeCode))
        .first();
      if (existing) await ctx.db.patch(existing._id, r);
      else await ctx.db.insert("routes", r);
    }
  },
});

/** Replace all stops for a route (they are static, so a clean swap is simplest). */
export const setStops = internalMutation({
  args: { routeCode: v.string(), stops: v.array(v.object(stopFields)) },
  handler: async (ctx, { routeCode, stops }) => {
    if (stops.length === 0) return; // keep cached stops if OASA hiccuped
    const old = await ctx.db
      .query("stops")
      .withIndex("by_route", (q) => q.eq("routeCode", routeCode))
      .collect();
    await Promise.all(old.map((s) => ctx.db.delete(s._id)));
    for (const s of stops) await ctx.db.insert("stops", s);
  },
});

export const setPoints = internalMutation({
  args: { routeCode: v.string(), points: v.array(v.object(pointFields)) },
  handler: async (ctx, { routeCode, points }) => {
    if (points.length === 0) return;
    const old = await ctx.db
      .query("routePoints")
      .withIndex("by_route", (q) => q.eq("routeCode", routeCode))
      .collect();
    await Promise.all(old.map((p) => ctx.db.delete(p._id)));
    for (const p of points) await ctx.db.insert("routePoints", p);
  },
});

/** Replace live buses for a route, dropping vehicles that are no longer reported. */
export const setBuses = internalMutation({
  args: { routeCode: v.string(), buses: v.array(v.object(busFields)) },
  handler: async (ctx, { routeCode, buses }) => {
    const old = await ctx.db
      .query("buses")
      .withIndex("by_route", (q) => q.eq("routeCode", routeCode))
      .collect();
    await Promise.all(old.map((b) => ctx.db.delete(b._id)));
    const now = Date.now();
    for (const b of buses) await ctx.db.insert("buses", { ...b, updatedAt: now });
  },
});

/* ------------------------------------------------------------------ *
 * Public actions — fetch from OASA (server-side) and cache via the
 * internal mutations above. The client calls these to load/refresh.
 * ------------------------------------------------------------------ */

/** Load the full line list. Call once when the app opens. */
export const loadLines = action({
  args: {},
  handler: async (ctx): Promise<number> => {
    const lines = await oasa.fetchLines();
    if (lines.length) await ctx.runMutation(internal.transit.upsertLines, { lines });
    return lines.length;
  },
});

/** Load the directions/routes for a line the user picked. */
export const loadLine = action({
  args: { lineCode: v.string() },
  handler: async (ctx, { lineCode }): Promise<number> => {
    const routes = await oasa.fetchRoutes(lineCode);
    if (routes.length) await ctx.runMutation(internal.transit.upsertRoutes, { routes });
    return routes.length;
  },
});

/** Load stops + the drawn path for a route. */
export const loadRoute = action({
  args: { routeCode: v.string() },
  handler: async (
    ctx,
    { routeCode },
  ): Promise<{ stops: number; points: number }> => {
    const [stops, points] = await Promise.all([
      oasa.fetchStops(routeCode),
      oasa.fetchPoints(routeCode),
    ]);
    await ctx.runMutation(internal.transit.setStops, { routeCode, stops });
    await ctx.runMutation(internal.transit.setPoints, { routeCode, points });
    return { stops: stops.length, points: points.length };
  },
});

/** Refresh live vehicle positions for a route. Called every ~12s by the client. */
export const refreshBuses = action({
  args: { routeCode: v.string() },
  handler: async (ctx, { routeCode }): Promise<number> => {
    const buses = await oasa.fetchBuses(routeCode);
    await ctx.runMutation(internal.transit.setBuses, { routeCode, buses });
    return buses.length;
  },
});

/** Estimated arrivals at a stop (returned directly; not cached). */
export const stopArrivals = action({
  args: { stopCode: v.string() },
  handler: async (ctx, { stopCode }): Promise<oasa.OasaArrival[]> =>
    oasa.fetchArrivals(stopCode),
});
