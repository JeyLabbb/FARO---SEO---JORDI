// personalize.mjs — escribe UNA línea de apertura ULTRA-personalizada para el
// email en frío, a partir de SOLO hechos reales del negocio (ficha de Places + su
// web). Usa gpt-4o-mini (mismo proveedor que classify-replies).
//
// REGLA DURA del proyecto: cero invención. El gancho solo puede apoyarse en los
// hechos que se le pasan. Si no hay nada lo bastante específico → generic:true y
// hook vacío (el email cae al opener normal, sin forzar una personalización falsa).
import "../config.mjs";

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = "gpt-4o-mini";

const clean = (s, n = 280) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

// Calle/zona aproximada desde la dirección formateada de Google.
export function neighborhood(address) {
  if (!address) return null;
  const parts = String(address).split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const street = parts[0];
  if (/^\d/.test(street) || street.length < 4) return null;
  return street.replace(/\s+\d+.*$/, "").trim() || null; // quita el número de portal
}

function factsBlock(f) {
  const L = [];
  L.push(`Negocio: ${f.negocio}`);
  if (f.ciudad) L.push(`Ciudad: ${f.ciudad}`);
  if (f.category) L.push(`Categoría (Google): ${f.category}`);
  if (f.address) L.push(`Dirección: ${clean(f.address, 120)}`);
  if (f.editorialSummary) L.push(`Descripción en Google: ${clean(f.editorialSummary)}`);
  if (f.title) L.push(`Título de su web: ${clean(f.title, 140)}`);
  if (f.h1) L.push(`Titular (H1) de su web: ${clean(f.h1, 140)}`);
  if (f.rating != null && f.reviewsCount != null) L.push(`Reseñas en Google: ${f.reviewsCount} (nota ${f.rating})`);
  if (Array.isArray(f.reviews) && f.reviews.length) {
    L.push(`Reseñas reales de clientes:`);
    for (const r of f.reviews.slice(0, 3)) { const t = clean(r, 200); if (t) L.push(`- "${t}"`); }
  }
  return L.join("\n");
}

// Números de 2+ cifras presentes en los hechos (para cazar invención en el hook).
const numsIn = (s) => new Set((String(s).match(/\d{2,}/g) || []));

/**
 * @param {object} f  { negocio, ciudad, category?, address?, editorialSummary?, title?, h1?, rating?, reviewsCount?, reviews?:string[] }
 * @returns {Promise<{hook:string, basis:string, generic:boolean}>}
 */
export async function personalize(f) {
  const facts = factsBlock(f);
  if (!OPENAI_KEY) return { hook: "", basis: "sin OPENAI_API_KEY", generic: true };

  const sys = [
    "Eres Jordi, de Faro (servicio de SEO local). Escribes la PRIMERA línea de un email en frío a un negocio, para que vea que te has fijado en ÉL de verdad y no es un envío masivo.",
    "Tono: humano y SECO, español de España, como alguien real que se ha fijado en un detalle concreto. Una frase (dos como mucho, muy cortas).",
    "REGLAS DURAS:",
    "- Trata SIEMPRE de TÚ singular (ofreces, llevas, tienes, te centras). NUNCA de vosotros (ofrecéis, lleváis) ni de usted.",
    "- Usa SOLO los hechos que te doy. PROHIBIDO inventar datos, cifras, servicios, premios o elogios que no aparezcan en los hechos.",
    "- SIEMPRE positivo o neutro. PROHIBIDO mencionar quejas, críticas, notas bajas, problemas, esperas o puntualidad, aunque salgan en las reseñas. Es un primer contacto: no se ofende a nadie.",
    "- PROHIBIDOS los signos de exclamación y el peloteo ('es genial', 'perfecto', 'me encanta', 'un gran punto a favor', 'enhorabuena'). Nada de entusiasmo impostado: suena a anuncio y a IA.",
    "- Sin guiones largos (—) ni rayas ni emojis: solo comas y puntos normales. Los guiones largos cantan a IA.",
    "- Tiene que ser CONCRETO y propio de ESTE negocio: un servicio o especialidad concreta, los años que llevan, algo distintivo de su web o algo específico que repiten sus clientes. Un elogio vago que valdría para cualquiera ('buena reputación', 'clientes contentos', 'gran trato', 'reseñas variadas') NO vale → generic=true.",
    "- Varía la forma de empezar; no uses siempre la misma fórmula.",
    "- No menciones aún SEO, Google ni el motivo del email. No nombres a personas salvo que sea claramente el dueño o profesional del negocio.",
    "- Si no hay nada lo bastante concreto y positivo, generic=true y hook vacío. Mejor vacío que genérico o forzado.",
    'Ejemplos BIEN: "Vi que te centras en ortodoncia invisible." · "Vi que llevas más de 30 años con la clínica."',
    'Ejemplos MAL: "¡Me encanta vuestro trabajo, es genial!" (peloteo + exclamación + vosotros) · "Tienes muy buena reputación." (genérico).',
    'Devuelve SOLO JSON: {"hook": "...", "basis": "hecho concreto (4-6 palabras)", "generic": true|false}.',
  ].join("\n");
  const usr = `Hechos del negocio:\n${facts}\n\nEscribe el gancho.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.5, response_format: { type: "json_object" }, messages: [{ role: "system", content: sys }, { role: "user", content: usr }] }),
    });
    const d = await r.json();
    const j = JSON.parse(d.choices?.[0]?.message?.content || "{}");
    let hook = clean(j.hook, 240).replace(/[¡!]+/g, "").replace(/\s*[—–]\s*/g, ", ").replace(/\s{2,}/g, " ").trim();
    const generic = !!j.generic || !hook;
    if (hook && !generic) {
      // Guard 1: jamás citar nada negativo (aunque el modelo se despiste).
      const NEG = /\b(quejas?|negativ\w*|problemas?|puntualidad|tardan?|demoras?|decepci\w*|defrauda\w*|desagrad\w*|insatisfe\w*)\b/i;
      if (NEG.test(hook)) return { hook: "", basis: "descartado: tono negativo", generic: true };
      // Guard 2: cifra de 2+ dígitos que NO está en los hechos = probable invención.
      const ok = numsIn(facts);
      const bad = [...numsIn(hook)].some((n) => !ok.has(n));
      if (bad) return { hook: "", basis: "descartado: cifra no verificable", generic: true };
    }
    return { hook: generic ? "" : hook, basis: clean(j.basis, 60), generic };
  } catch (e) {
    return { hook: "", basis: "error IA: " + clean(e.message, 40), generic: true };
  }
}
