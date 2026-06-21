// dataforseo.mjs — cliente DataForSEO v3. Da el Map Pack REAL (no aproximado)
// por keyword+coordenadas, y listados de negocios con teléfono/web.
// Auth HTTP Basic con DATAFORSEO_LOGIN/PASSWORD (creds en .env → de la torre de Jorge).
// Estado: ESCRITO, sin probar (faltan creds). Se activa solo cuando estén en .env.
import "../config.mjs"; // asegura que .env está cargado

const LOGIN = process.env.DATAFORSEO_LOGIN || "";
const PASSWORD = process.env.DATAFORSEO_PASSWORD || "";
export const HAS_DATAFORSEO = Boolean(LOGIN && PASSWORD);
const BASE = "https://api.dataforseo.com/v3";

let SPENT = 0;
/** Gasto acumulado de DataForSEO en este proceso (USD), leído del campo `cost`. */
export function dfsSpend() { return SPENT; }

function authHeader() {
  return "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
}

async function postTask(path, task) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify([task]),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
  const t = data.tasks?.[0];
  if (!t || t.status_code >= 40000)
    throw new Error(`DataForSEO ${t?.status_code}: ${t?.status_message || "error"}`);
  SPENT += t.cost || 0;
  return t.result?.[0] || null;
}

/**
 * Map Pack real para "keyword" en (lat,lng). Devuelve el top con
 * { rank, name, place_id, rating, reviews, phone, domain, address }.
 */
export async function mapPack(keyword, lat, lng, zoom = 14) {
  const r = await postTask("/serp/google/maps/live/advanced", {
    keyword,
    location_coordinate: `${lat},${lng},${zoom}z`,
    language_code: "es",
    device: "mobile",
  });
  const items = (r?.items || []).filter((it) => it.place_id || it.title);
  return items.map((it) => ({
    rank: it.rank_absolute ?? it.rank_group ?? null,
    name: it.title,
    place_id: it.place_id || null,
    rating: it.rating?.value != null ? Number(it.rating.value) : null,
    reviews: Number(it.rating?.votes_count) || 0,
    phone: it.phone || null,
    domain: it.domain || null,
    address: it.address || null,
  }));
}

/** Posición de un negocio (por place_id o nombre) en el Map Pack real. */
export async function mapRank(keyword, lat, lng, { placeId, name } = {}) {
  const pack = await mapPack(keyword, lat, lng);
  const norm = (s) => (s || "").toLowerCase();
  const firstTok = norm(name).split(/\s+/)[0] || "";
  const hit = pack.find(
    (p) =>
      (placeId && p.place_id === placeId) ||
      (name && firstTok && norm(p.name).includes(firstTok))
  );
  return { rank: hit ? hit.rank : null, pack };
}

/**
 * Listado de negocios por categoría(s)+zona CON contacto (teléfono/web).
 * El endpoint exige `location_coordinate` = "lat,lng,RADIO" (radio en km).
 * Devuelve hasta `limit` (máx 1000) por llamada; coste ~$0.013/llamada.
 */
export async function businessListings(category, lat, lng, opts = {}) {
  const { radius = 15, limit = 100 } = typeof opts === "number" ? { limit: opts } : (opts || {});
  const r = await postTask("/business_data/business_listings/search/live", {
    categories: Array.isArray(category) ? category : [category],
    location_coordinate: `${lat},${lng},${radius}`,
    limit,
  });
  return (r?.items || []).map((it) => ({
    name: it.title,
    place_id: it.place_id || null,
    category: it.category || null,
    rating: it.rating?.value != null ? Number(it.rating.value) : null,
    reviews: Number(it.rating?.votes_count) || 0,
    phone: it.phone || null,
    website: it.url || it.domain || null,
    city: (it.address_info && (it.address_info.city || it.address_info.region)) || null,
    address: it.address || null,
  }));
}
