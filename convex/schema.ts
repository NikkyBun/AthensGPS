import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema for AthensGPS.
 *
 * The unofficial OASA telematics API is fetched server-side (in actions) and
 * cached into these tables. The React Native client never talks to OASA
 * directly — it subscribes to these tables with reactive queries, so live bus
 * positions update on screen the moment a server-side refresh writes them.
 */
export default defineSchema({
  // All transit lines (e.g. "550", "Α8"). Refreshed rarely.
  lines: defineTable({
    lineCode: v.string(), // OASA internal code, the key we look lines up by
    lineId: v.string(), // public-facing number, e.g. "021" / "550"
    descr: v.string(), // Greek description
    descrEng: v.string(), // English description (may be blank)
  }).index("by_code", ["lineCode"]),

  // Directions/variants of a line (usually 2: outbound / inbound).
  routes: defineTable({
    routeCode: v.string(),
    lineCode: v.string(),
    descr: v.string(),
    descrEng: v.string(),
    type: v.string(),
    distance: v.string(),
  })
    .index("by_line", ["lineCode"])
    .index("by_code", ["routeCode"]),

  // Ordered stops along a route.
  stops: defineTable({
    routeCode: v.string(),
    stopCode: v.string(),
    stopId: v.string(),
    descr: v.string(),
    descrEng: v.string(),
    lat: v.number(),
    lng: v.number(),
    order: v.number(),
  }).index("by_route", ["routeCode"]),

  // The drawn polyline of a route.
  routePoints: defineTable({
    routeCode: v.string(),
    lat: v.number(),
    lng: v.number(),
    order: v.number(),
  }).index("by_route", ["routeCode"]),

  // Live vehicle positions, replaced on every refresh of a route.
  buses: defineTable({
    routeCode: v.string(),
    vehicleNo: v.string(),
    lat: v.number(),
    lng: v.number(),
    timestamp: v.string(), // raw CS_DATE from OASA
    updatedAt: v.number(), // Date.now() when we wrote it
  }).index("by_route", ["routeCode"]),
});
