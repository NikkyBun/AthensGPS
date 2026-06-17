/**
 * Thin client for the (unofficial, undocumented) OASA telematics API.
 *
 * Every call is GET https://telematics.oasa.gr/api/?act=<action>&p1=<param>.
 *
 * IMPORTANT: the endpoint must be HTTPS. Plain http:// now returns an empty
 * body (the original native app whitelisted cleartext HTTP, but that path is
 * dead). Responses are JSON arrays served with a `text/html` content-type, so
 * we parse them ourselves via res.json() (which ignores content-type).
 *
 * The backend is flaky: any failure resolves to an empty array rather than
 * throwing, mirroring the defensive behaviour of the original repository.
 *
 * This module is plain TypeScript with no Convex bindings — it is imported by
 * the actions in transit.ts, where the global `fetch` is available.
 */

const BASE = "https://telematics.oasa.gr/api/";

async function call(act: string, p1?: string): Promise<any[]> {
  const url = new URL(BASE);
  url.searchParams.set("act", act);
  if (p1 !== undefined) url.searchParams.set("p1", p1);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "AthensGPS/1.0 (Expo; +convex)" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const str = (x: unknown): string => (x == null ? "" : String(x)).trim();
const num = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : null;
};
const int = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : parseInt(String(x), 10);
  return Number.isFinite(n) ? n : null;
};

export type OasaLine = {
  lineCode: string;
  lineId: string;
  descr: string;
  descrEng: string;
};
export type OasaRoute = {
  routeCode: string;
  lineCode: string;
  descr: string;
  descrEng: string;
  type: string;
  distance: string;
};
export type OasaStop = {
  routeCode: string;
  stopCode: string;
  stopId: string;
  descr: string;
  descrEng: string;
  lat: number;
  lng: number;
  order: number;
};
export type OasaPoint = { routeCode: string; lat: number; lng: number; order: number };
export type OasaBus = {
  routeCode: string;
  vehicleNo: string;
  lat: number;
  lng: number;
  timestamp: string;
};
export type OasaArrival = { routeCode: string; vehicleCode: string; minutes: number };

/** All lines. */
export async function fetchLines(): Promise<OasaLine[]> {
  const raw = await call("webGetLines");
  return raw
    .filter((l) => str(l?.LineCode))
    .map((l) => ({
      lineCode: str(l.LineCode),
      lineId: str(l.LineID),
      descr: str(l.LineDescr),
      descrEng: str(l.LineDescrEng),
    }));
}

/** Directions/routes of a line. */
export async function fetchRoutes(lineCode: string): Promise<OasaRoute[]> {
  const raw = await call("webGetRoutes", lineCode);
  return raw
    .filter((r) => str(r?.RouteCode))
    .map((r) => ({
      routeCode: str(r.RouteCode),
      lineCode: str(r.LineCode) || lineCode,
      descr: str(r.RouteDescr),
      descrEng: str(r.RouteDescrEng),
      type: str(r.RouteType),
      distance: str(r.RouteDistance),
    }));
}

/** Ordered stops of a route. */
export async function fetchStops(routeCode: string): Promise<OasaStop[]> {
  const raw = await call("webGetStops", routeCode);
  const out: OasaStop[] = [];
  raw.forEach((s, i) => {
    const lat = num(s?.StopLat);
    const lng = num(s?.StopLng);
    if (lat == null || lng == null || !str(s?.StopCode)) return;
    out.push({
      routeCode,
      stopCode: str(s.StopCode),
      stopId: str(s.StopID),
      descr: str(s.StopDescr),
      descrEng: str(s.StopDescrEng),
      lat,
      lng,
      order: int(s?.RouteStopOrder) ?? i + 1,
    });
  });
  return out;
}

/** The drawn path (polyline) of a route. */
export async function fetchPoints(routeCode: string): Promise<OasaPoint[]> {
  const raw = await call("webRouteDetails", routeCode);
  const out: OasaPoint[] = [];
  raw.forEach((p, i) => {
    const lat = num(p?.routed_y);
    const lng = num(p?.routed_x);
    if (lat == null || lng == null) return;
    out.push({ routeCode, lat, lng, order: int(p?.routed_order) ?? i + 1 });
  });
  return out;
}

/** Live vehicle positions on a route. */
export async function fetchBuses(routeCode: string): Promise<OasaBus[]> {
  const raw = await call("getBusLocation", routeCode);
  const out: OasaBus[] = [];
  for (const b of raw) {
    const lat = num(b?.CS_LAT);
    const lng = num(b?.CS_LNG);
    if (lat == null || lng == null) continue;
    out.push({
      routeCode,
      vehicleNo: str(b?.VEH_NO),
      lat,
      lng,
      timestamp: str(b?.CS_DATE),
    });
  }
  return out;
}

/** Estimated arrivals (minutes) at a stop. */
export async function fetchArrivals(stopCode: string): Promise<OasaArrival[]> {
  const raw = await call("getStopArrivals", stopCode);
  return raw
    .map((a) => ({
      routeCode: str(a?.route_code),
      vehicleCode: str(a?.veh_code),
      minutes: int(a?.btime2) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.minutes - b.minutes);
}
