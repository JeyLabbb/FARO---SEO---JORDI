// audit.mjs — orquesta la recogida de datos y construye el objeto de auditoría
// que luego pinta render.mjs. Toda la lógica de "qué falla y qué arreglar
// primero" (los 3 quick wins) vive aquí.
import { resolveLocationBias } from "../config.mjs";
import {
  textSearch,
  placeDetails,
  resolvePlace,
} from "./places.mjs";
import { analyzeWebsite } from "./website.mjs";
import { mobileSpeed } from "./pagespeed.mjs";
import { HAS_DATAFORSEO, mapPack } from "./dataforseo.mjs";
import { normalize } from "./slug.mjs";

// primaryType demasiado genéricos => seguramente la categoría está mal puesta.
const GENERIC_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "store",
  "",
]);

function summarize(place) {
  if (!place) return null;
  return {
    id: place.id,
    name: place.displayName?.text || place.displayName || "(sin nombre)",
    rating: place.rating != null ? Number(place.rating) : null,
    reviews: Number(place.userRatingCount) || 0,
    primaryType: place.primaryType || null,
    category: place.primaryTypeDisplayName?.text || place.primaryType || null,
    types: place.types || [],
    website: place.websiteUri || null,
  };
}

/**
 * Construye la auditoría completa a partir de un brief.
 * @param {object} brief  { name, city, placeId?, website?, searches[], competitors[]?, lat?, lng?, radius? }
 */
export async function buildAudit(brief, opts = {}) {
  const notes = []; // avisos no fatales para el pie del informe
  let bias = resolveLocationBias(brief);
  const searches = (brief.searches || []).filter(Boolean).slice(0, 3);

  // 1) Resolver la ficha del negocio.
  let businessPlace;
  if (brief.placeId) {
    businessPlace = await placeDetails(brief.placeId);
  } else {
    const found = await resolvePlace(brief.name, brief.city, bias);
    if (!found) {
      throw new Error(
        `No se encontró el negocio "${brief.name}" en Google. ` +
          `Prueba con el nombre exacto de la ficha o pasa "placeId" en el brief.`
      );
    }
    businessPlace = await placeDetails(found.id);
  }
  const business = summarize(businessPlace);
  business.detail = businessPlace; // guardamos el detalle crudo (fotos, reseñas, horario)

  // ⚠ Clave: buscar el Map Pack en la UBICACIÓN REAL del negocio (no en la
  // ciudad por defecto). Sin esto, un negocio de Getafe se buscaba en Pamplona
  // → salía "fuera del top 20" y con competidores de otra ciudad.
  if (businessPlace.location?.latitude != null) {
    bias = {
      lat: businessPlace.location.latitude,
      lng: businessPlace.location.longitude,
      radius: bias.radius || 12000,
    };
  }

  // 2-4) Competidores + posiciones.
  //   Con DataForSEO → Map Pack REAL (posición exacta + competidores reales con
  //   teléfono). Sin él → orden de Places (aproximado). Mismo formato de salida.
  let competitors = [];
  let positions = [];
  let mapPackReal = false;

  if (HAS_DATAFORSEO && !opts.cold && searches.length) {
    mapPackReal = true;
    const packs = [];
    for (const q of searches) {
      try {
        packs.push({ query: q, items: await mapPack(q, bias.lat, bias.lng) });
      } catch (err) {
        packs.push({ query: q, items: [], error: err.message });
        notes.push(`Map Pack "${q}" falló: ${err.message}`);
      }
    }
    // Emparejamos por place_id: Places y DataForSEO usan el MISMO id de Google,
    // así que es exacto (nada de confundir negocios por palabras comunes).
    const rankById = (items, pid) => {
      if (!pid) return null;
      const hit = items.find((it) => it.place_id === pid);
      return hit ? hit.rank : null;
    };
    const fromPack = (it) => ({
      id: it.place_id, name: it.name, reviews: it.reviews || 0,
      rating: it.rating, website: it.domain, phone: it.phone,
    });
    if (brief.competitors && brief.competitors.length) {
      for (const cn of brief.competitors.slice(0, 3)) {
        try {
          const found = await resolvePlace(cn, brief.city, bias);
          if (found) competitors.push(summarize(found));
          else notes.push(`Competidor "${cn}" no encontrado en Google.`);
        } catch (err) {
          notes.push(`Competidor "${cn}": ${err.message}`);
        }
      }
    } else {
      const seenIds = new Set([business.id]);
      for (const it of packs[0]?.items || []) {
        if (!it.place_id || seenIds.has(it.place_id)) continue;
        seenIds.add(it.place_id);
        competitors.push(fromPack(it));
        if (competitors.length >= 3) break;
      }
      notes.push("Posición y competidores del Map Pack REAL de Google (DataForSEO).");
    }
    positions = packs.map(({ query, items, error }) => ({
      query,
      error,
      business: rankById(items, business.id),
      competitors: competitors.map((c) => ({ name: c.name, pos: rankById(items, c.id) })),
    }));
  } else {
    // ── Fallback Places (posición aproximada por orden de resultados) ──
    const searchResults = [];
    for (const q of searches) {
      try {
        searchResults.push({ query: q, results: await textSearch(q, bias, 20) });
      } catch (err) {
        searchResults.push({ query: q, results: [], error: err.message });
        notes.push(`Búsqueda "${q}" falló: ${err.message}`);
      }
    }
    if (brief.competitors && brief.competitors.length) {
      for (const name of brief.competitors.slice(0, 3)) {
        try {
          const found = await resolvePlace(name, brief.city, bias);
          if (found) competitors.push(summarize(found));
          else notes.push(`Competidor "${name}" no encontrado en Google.`);
        } catch (err) {
          notes.push(`Competidor "${name}" falló: ${err.message}`);
        }
      }
    } else if (searchResults[0]?.results?.length) {
      const seenNames = new Set([normalize(business.name)]);
      for (const p of searchResults[0].results) {
        if (p.id === business.id) continue;
        const key = normalize(p.displayName?.text || p.displayName || "");
        if (!key || seenNames.has(key)) continue;
        seenNames.add(key);
        competitors.push(summarize(p));
        if (competitors.length >= 3) break;
      }
      notes.push(`Competidores auto-detectados de "${searchResults[0].query}" (posición aproximada de Places).`);
    }
    positions = searchResults.map(({ query, results, error }) => {
      const rankOf = (id) => {
        const idx = results.findIndex((p) => p.id === id);
        return idx === -1 ? null : idx + 1;
      };
      return {
        query,
        error,
        business: rankOf(business.id),
        competitors: competitors.map((c) => ({ name: c.name, pos: rankOf(c.id) })),
      };
    });
  }

  // 5) Web propia + velocidad móvil (en paralelo).
  const websiteUrl = brief.website || business.website || null;
  const [web, speed] = await Promise.all([
    analyzeWebsite(websiteUrl, { city: brief.city, keywords: searches }),
    opts.skipSpeed
      ? Promise.resolve({ score: null, lcp: null, cls: null, error: "omitido (modo rápido)" })
      : mobileSpeed(websiteUrl),
  ]);

  // 6) Derivados de la ficha.
  const detail = businessPlace;
  const photosCount = Array.isArray(detail.photos) ? detail.photos.length : 0;
  const hasHours = Boolean(detail.regularOpeningHours?.weekdayDescriptions?.length);
  const reviewsSample = (detail.reviews || []).map((r) => ({
    rating: r.rating,
    author: r.authorAttribution?.displayName || "Anónimo",
    when: r.relativePublishTimeDescription || null,
    text: r.text?.text || r.originalText?.text || "",
  }));
  const lastReviewWhen = reviewsSample[0]?.when || null;
  const mapsUri = detail.googleMapsUri || null;

  const bestCompetitor =
    competitors.length > 0
      ? competitors.reduce((a, b) => (b.reviews > a.reviews ? b : a))
      : null;

  // 7) Quick wins (heurística honesta; elegimos los 3 de más impacto).
  const candidates = [];
  const add = (weight, title, detailText) =>
    candidates.push({ weight, title, detail: detailText });

  if (!business.primaryType || GENERIC_TYPES.has(business.primaryType)) {
    add(9, "Fijar la categoría principal correcta",
      "La categoría principal es lo que más mueve el ranking local y ahora parece genérica o vacía.");
  }
  if (!hasHours) {
    add(8, "Configurar el horario en la ficha (incl. festivos)",
      "La ficha no tiene horario configurado. Es un dato básico que Google premia y que el cliente mira antes de ir.");
  }
  if (photosCount < 10) {
    add(7, "Subir fotos a la ficha (y de forma regular)",
      `Se ven ~${photosCount} fotos. Más fotos = más clics, llamadas y rutas.`);
  }
  if (bestCompetitor && business.reviews < bestCompetitor.reviews * 0.7) {
    add(8, "Arrancar una campaña de reseñas",
      `Tienes ${business.reviews} reseñas vs ${bestCompetitor.reviews} del mejor competidor (${bestCompetitor.name}). Pedir a todos los clientes con link/QR.`);
  }
  if (web.url && !web.hasLocalBusinessSchema) {
    add(6, "Añadir schema LocalBusiness (JSON-LD) a la web",
      "No se detecta marcado de negocio local; ayuda a Google a entender la ficha.");
  }
  if (web.url && web.reachable && !web.hasLocalKeywordInTitleOrH1) {
    add(7, "Meter keyword local en el title y el H1 de la web",
      "Ni el título ni el H1 incluyen la ciudad/servicio objetivo. Es barato y mueve.");
  }
  if (speed.score != null && speed.score < 50) {
    add(speed.score < 30 ? 7 : 5, "Mejorar la velocidad en móvil",
      `PageSpeed móvil ${speed.score}/100. Imágenes pesadas y scripts suelen ser la causa.`);
  }
  if (web.url && web.reachable && !web.hasEmbeddedMap) {
    add(4, "Embeber el mapa de Google + página de localización",
      "Refuerza la señal local y la consistencia de NAP.");
  }
  if (web.url && web.reachable && !web.hasPhone) {
    add(5, "Poner el teléfono/NAP visible en la web (footer)",
      "No se detecta teléfono en la home. NAP consistente = confianza + señal local.");
  }
  if (lastReviewWhen && /a(?:ñ|n)o|year/i.test(lastReviewWhen)) {
    add(6, "Reactivar la recencia de reseñas",
      `La última reseña es de "${lastReviewWhen}". La recencia es señal de ranking.`);
  }

  const quickWins = candidates.sort((a, b) => b.weight - a.weight).slice(0, 3);

  return {
    generatedAt: new Date(),
    brief,
    business,
    competitors,
    bestCompetitor,
    positions,
    mapPackReal,
    coldMode: !!opts.cold,
    searches,
    web,
    speed,
    gbp: {
      category: business.category,
      primaryType: business.primaryType,
      secondaryTypes: business.types.filter((t) => t !== business.primaryType),
      photosCount,
      hasHours,
      reviews: business.reviews,
      rating: business.rating,
      lastReviewWhen,
      reviewsSample,
      mapsUri,
    },
    quickWins,
    notes,
  };
}
