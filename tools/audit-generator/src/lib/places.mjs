// places.mjs — cliente de la Google Places API (New), oficial.
//
// IMPORTANTE (ver 05-marrones-y-politicas.md):
//   - Usamos SOLO la API oficial de Places. NO scrapeamos los resultados de
//     búsqueda de Google (va contra sus ToS y bloquean la IP).
//   - La "posición" de la sección 1 del audit es una APROXIMACIÓN calculada con
//     el orden de Places Text Search sesgado por ubicación. NO es el ranking
//     exacto del Map Pack — así se etiqueta honestamente en el informe.
import {
  GOOGLE_MAPS_API_KEY,
  LANGUAGE_CODE,
  REGION_CODE,
} from "../config.mjs";
import { normalize } from "./slug.mjs";

const BASE = "https://places.googleapis.com/v1";

// Campos que pedimos en Text Search (máscara mínima = menos coste).
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.websiteUri",
  "places.formattedAddress",
  "places.location",
].join(",");

// Campos para el detalle de una ficha concreta.
const DETAIL_FIELDS = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "websiteUri",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "formattedAddress",
  "location",
  "googleMapsUri",
  "businessStatus",
  "regularOpeningHours",
  "photos",
  "reviews",
  "editorialSummary",
].join(",");

class PlacesError extends Error {}

async function postJson(url, body, fieldMask) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new PlacesError(`Places API ${res.status}: ${msg}`);
  }
  return data;
}

async function getJson(url, fieldMask) {
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new PlacesError(`Places API ${res.status}: ${msg}`);
  }
  return data;
}

/**
 * Búsqueda de texto sesgada por ubicación. Devuelve hasta `maxResultCount`
 * fichas en el orden que da Google (proxy aproximado del Map Pack).
 */
export async function textSearch(textQuery, bias, maxResultCount = 20) {
  const body = {
    textQuery,
    languageCode: LANGUAGE_CODE,
    regionCode: REGION_CODE,
    maxResultCount,
  };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: bias.radius || 12000,
      },
    };
  }
  const data = await postJson(`${BASE}/places:searchText`, body, SEARCH_FIELDS);
  return data.places || [];
}

/** Detalle completo de una ficha por su place id. */
export async function placeDetails(placeId) {
  return getJson(`${BASE}/places/${encodeURIComponent(placeId)}`, DETAIL_FIELDS);
}

/**
 * Resuelve un nombre de negocio a una ficha concreta: busca "nombre, ciudad"
 * y devuelve el primer resultado (id + resumen). null si no encuentra nada.
 */
export async function resolvePlace(name, city, bias) {
  const query = city ? `${name}, ${city}` : name;
  const results = await textSearch(query, bias, 8);
  if (!results.length) return null;
  // Elige el resultado cuyo nombre encaja mejor con lo buscado (no el [0] a
  // ciegas: "Punto Pilates" no debe resolver a "Mª Jesús Carretero Center").
  const qTokens = normalize(name).split(/\s+/).filter((t) => t.length >= 3);
  const score = (p) => {
    const dn = normalize(p.displayName?.text || "");
    return qTokens.reduce((n, t) => n + (dn.includes(t) ? 1 : 0), 0);
  };
  let best = results[0];
  let bestScore = score(results[0]);
  for (const p of results) {
    const sc = score(p);
    if (sc > bestScore) {
      best = p;
      bestScore = sc;
    }
  }
  return best;
}

/**
 * Para una búsqueda objetivo, calcula la posición aproximada de cada ficha
 * cuyo id esté en `targetIds`. Devuelve { query, ranking: Map<id, posición> }.
 * La posición es 1-indexada sobre los resultados de Places (no el Map Pack real).
 */
export async function findPositions(query, bias, targetIds) {
  const results = await textSearch(query, bias, 20);
  const ranking = new Map();
  results.forEach((place, idx) => {
    if (targetIds.includes(place.id)) ranking.set(place.id, idx + 1);
  });
  return { query, results, ranking };
}

export { PlacesError };
