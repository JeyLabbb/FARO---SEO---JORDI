// website.mjs — analiza la web PROPIA del cliente (su sitio público) para la
// sección 4 del audit. Esto es legítimo: es su web, una sola página, con
// User-Agent honesto. No tiene nada que ver con scrapear los SERPs de Google.
import { USER_AGENT } from "../config.mjs";
import { normalize } from "./slug.mjs";

// Tipos de schema.org que cuentan como "ficha de negocio local".
const LOCAL_BUSINESS_TYPES = [
  "localbusiness",
  "medicalbusiness",
  "medicalclinic",
  "medicalorganization",
  "dentist",
  "physician",
  "physiotherapy",
  "healthclub",
  "healthandbeautybusiness",
  "beautysalon",
  "hairsalon",
  "dayspa",
  "sportsactivitylocation",
  "professionalservice",
  "exercisegym",
  "yogastudio",
];

function firstMatch(re, html) {
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

/** Quita etiquetas para poder buscar texto plano (NAP, etc.). */
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function detectSchema(html) {
  const types = new Set();
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const block = m[1];
    // En vez de parsear (a veces es JSON inválido), buscamos los @type a pelo.
    const typeRe = /"@type"\s*:\s*("?\[?[^,\]\}]+)/gi;
    let t;
    while ((t = typeRe.exec(block))) {
      const raw = normalize(t[1].replace(/["'\[\]]/g, ""));
      types.add(raw);
    }
  }
  const all = [...types];
  const hasLocalBusiness = all.some((t) =>
    LOCAL_BUSINESS_TYPES.some((lb) => t.includes(lb))
  );
  return { hasLocalBusiness, schemaTypes: all };
}

/**
 * @param {string} url
 * @param {{city?:string, keywords?:string[]}} ctx  Contexto para "keyword local".
 */
export async function analyzeWebsite(url, ctx = {}) {
  const result = {
    url: url || null,
    reachable: false,
    title: null,
    h1: null,
    hasLocalBusinessSchema: false,
    schemaTypes: [],
    hasViewport: false,
    hasEmbeddedMap: false,
    hasPhone: false,
    hasLocalKeywordInTitleOrH1: false,
    error: null,
  };
  if (!url) {
    result.error = "el negocio no tiene web en su ficha";
    return result;
  }

  let html;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      result.error = `la web respondió HTTP ${res.status}`;
      return result;
    }
    html = await res.text();
    result.reachable = true;
  } catch (err) {
    result.error =
      err.name === "AbortError" ? "timeout al cargar la web" : err.message;
    return result;
  }

  result.title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  result.h1 = firstMatch(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html);
  if (result.h1) result.h1 = result.h1.replace(/<[^>]+>/g, "").trim();

  const schema = detectSchema(html);
  result.hasLocalBusinessSchema = schema.hasLocalBusiness;
  result.schemaTypes = schema.schemaTypes;

  result.hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

  result.hasEmbeddedMap =
    /google\.[a-z.]+\/maps\/embed/i.test(html) ||
    /maps\.google\.[a-z.]+/i.test(html) ||
    /<iframe[^>]+google[^>]+maps/i.test(html);

  const text = stripTags(html);
  result.hasPhone =
    /href=["']tel:/i.test(html) ||
    /(?:\+?34[\s.-]?)?[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/.test(text);

  // ¿Aparece la ciudad o alguna keyword objetivo en el title/H1?
  const haystack = normalize(`${result.title || ""} ${result.h1 || ""}`);
  const needles = [ctx.city, ...(ctx.keywords || [])]
    .filter(Boolean)
    .map((k) => normalize(k))
    // de "fisio pamplona" sacamos también palabras sueltas
    .flatMap((k) => [k, ...k.split(/\s+/)])
    .filter((k) => k.length >= 4);
  result.hasLocalKeywordInTitleOrH1 = needles.some((n) => haystack.includes(n));

  return result;
}
