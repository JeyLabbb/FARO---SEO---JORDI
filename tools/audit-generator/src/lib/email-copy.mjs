// email-copy.mjs — redacta ASUNTO + CUERPO del email frío a partir de los datos
// REALES de la auditoría. Enfoque: COMPARATIVO y de EXPERTO (no "sube fotos"):
// se lidera con un índice de VISIBILIDAD (tu % vs el de los que salen arriba),
// derivado de las posiciones reales en el Map Pack. Honesto: cifras reales,
// índice etiquetado como nuestro. Objetivo: que sientan el problema y abran el PDF.
//
// `f` (findings) viene del JSON de audit-batch (projectFindings):
//   { reviews, rating, bestCompetitor:{name,reviews}|null, posMeasured, avgPos,
//     businessRanked, businessVisibility, competitorVisibility, speed, photos,
//     hasHours, quickWins:[{title,detail}], primarySearch }

// Hasta 3 problemas, comparativos y "de experto" (cosas que el dueño no sabe
// arreglar solo), liderando con la visibilidad.
export function gaps(f, ciudad) {
  const out = [];

  // 1) Visibilidad comparada — SOLO si de verdad va por detrás (si lidera, NO mentimos).
  const behind = f.posMeasured && f.businessVisibility != null && f.competitorVisibility != null && f.businessVisibility < f.competitorVisibility - 8;
  if (behind) {
    const you = f.businessVisibility;
    const them = f.competitorVisibility;
    if (you < 12) {
      out.push(`Ahora mismo sois casi invisibles en el mapa de Google de ${ciudad}: vuestra visibilidad está en ~${you}% y los que salen arriba rondan el ~${them}%. Quien os busca por la zona, no os encuentra`);
    } else {
      out.push(`Vuestra visibilidad en el mapa de Google está en ~${you}%, muy por detrás de los de vuestra zona (~${them}%). Esa diferencia es la mayoría de llamadas y reservas que se van a ellos`);
    }
  }

  // 2) Autoridad/reseñas, pero enmarcada como SEÑAL DE RANKING (no "pide reseñas").
  if (f.bestCompetitor && f.reviews < f.bestCompetitor.reviews * 0.7) {
    out.push(`Google ordena por confianza y ahí vais cortos: el referente de vuestra zona acumula ${f.bestCompetitor.reviews} reseñas y vosotros ${f.reviews}. No es "pedir reseñas y ya". Es la señal nº1 que mira Google para decidir a quién enseña primero`);
  }

  // 3) Relleno "de experto" si falta para llegar a 2 (honesto según el caso).
  if (out.length < 2 && f.speed != null && f.speed < 50) {
    out.push(`Vuestra web carga lenta en móvil (${f.speed}/100 según Google) y eso, además de espantar gente, os baja en el ranking, y la mayoría no sabe que Google lo mide`);
  }
  if (out.length < 2 && (behind || (f.bestCompetitor && f.reviews < f.bestCompetitor.reviews))) {
    out.push(`Vuestra ficha no está optimizada para las búsquedas que de verdad traen clientes en ${ciudad} (lo que la gente teclea cuando busca lo vuestro)`);
  }
  if (!out.length) {
    out.push(`Estáis bien posicionados, pero hay un par de cosas para consolidar la posición y que no os adelanten los de al lado. El mapa de Google se mueve constantemente`);
  }

  return out.slice(0, 3);
}

// ¿El negocio va claramente por detrás en visibilidad? (umbral honesto)
function isBehind(f) {
  return f.posMeasured && f.businessVisibility != null && f.competitorVisibility != null && f.businessVisibility < f.competitorVisibility - 8;
}
// Recorta nombres largos/sucios (quita comillas, corta en separadores, limita
// longitud sin dejar conectores colgando) para que asuntos y cuerpos queden limpios.
function tidy(name, max = 32) {
  let s = String(name || "").replace(/["“”']/g, "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+[—|·]\s+/)[0].trim();
  if (s.length > max) {
    const w = s.split(" "); let o = "";
    for (const x of w) { if ((o + " " + x).trim().length > max) break; o = (o + " " + x).trim(); }
    s = o || s.slice(0, max);
  }
  return s.replace(/[\s\-–—|·,]+$/, "").replace(/\s+(y|de|del|la|el|las|los|&|en|con|para|i)$/i, "").trim();
}
const whoNamed = (f) => (f.bestCompetitor && f.compNamed && f.bestCompetitor.name) ? tidy(f.bestCompetitor.name, 32) : null;
// Gancho personalizado real (de personalize.mjs). [] si no hay gancho propio → el
// email cae al opener normal (NUNCA forzamos una personalización falsa/genérica).
const hasHook = (f) => Boolean(f.hook && !f.hookGeneric);
const hookLines = (f) => hasHook(f) ? [f.hook, ``] : [];

export function subject(f, negocio, ciudad) {
  return `te busqué en Google, ${tidy(negocio, 32)}`;
}

// Email INICIAL — humano y CORTO (estilo Jorge): sin jerga, frases simples,
// nombra al que sale primero, cierra con "¿te lo enseño en 10 min?". PDF adjunto.
export function bodyText(f, negocio, ciudad) {
  const search = f.primarySearch || `lo tuyo en ${ciudad}`;
  const comp = whoNamed(f);
  const behind = isBehind(f) || (f.bestCompetitor && f.reviews < f.bestCompetitor.reviews * 0.7);
  const intro = hookLines(f);
  const sale = intro.length ? "cómo sales" : `cómo sale ${negocio}`;
  if (behind) {
    const quien = comp ? `Los primeros del mapa son ${comp} y un par más.` : `Salen otros negocios de la zona antes que tú.`;
    return [
      `Hola,`,
      ``,
      ...intro,
      `Busqué «${search}» en Google para ver ${sale} y apareces bastante abajo. ${quien} No es nada raro: Google todavía no te tiene la ficha del todo afinada, y casi todo el mundo llama a los tres primeros que ve.`,
      ``,
      `Te paso un informe de una página con cómo estás. ¿Te lo enseño en 10 minutos y vemos cómo subir?`,
      ``,
      `Un saludo,`,
      `Jordi · Faro`,
    ].join("\n");
  }
  return [
    `Hola,`,
    ``,
    ...intro,
    `Busqué «${search}» en Google para ver ${sale} y la verdad es que sales bastante bien. Aun así vi un par de cosas de la ficha que afinaría para que no te adelanten. El mapa de Google se mueve y conviene no dormirse.`,
    ``,
    `Te paso un informe de una página con lo que vi. ¿Te lo enseño en 10 minutos?`,
    ``,
    `Un saludo,`,
    `Jordi · Faro`,
  ].join("\n");
}

// Asunto de los seguimientos: "Re: <asunto original>" (cae en el mismo hilo).
export function followupSubject(f, negocio, ciudad) {
  return `Re: ${subject(f, negocio, ciudad)}`;
}

// SEGUIMIENTOS (n = 1, 2) — humanos y cortos, estilo Jorge. Sin adjunto. Solo 2 toques.
export function followupBody(n, f, negocio, ciudad) {
  const search = f.primarySearch || `lo tuyo en ${ciudad}`;
  const comp = whoNamed(f);
  const behind = isBehind(f) || (f.bestCompetitor && f.reviews < f.bestCompetitor.reviews * 0.7);
  if (behind) {
    if (n === 1) return `Hola, te escribí hace unos días sobre cómo sale ${negocio} en Google en ${ciudad}. Cuando buscan «${search}», ${comp ? `${comp} y otros salen antes que tú` : `salen otros antes que tú`}. Es lo que sé arreglar. ¿Lo vemos en 10 minutos?\n\nJordi`;
    return `Hola, retomo lo de ${negocio} en Google: ya sales, pero cuando buscan «${search}» Google pone antes a ${comp || "otros"}. Cerrar esa distancia es justo lo que hacemos. ¿Lo vemos 10 minutos?\n\nJordi`;
  }
  if (n === 1) return `Hola, te escribí hace unos días sobre cómo sale ${negocio} en Google en ${ciudad}. Estás bien, pero hay un par de ajustes en la ficha que aseguran el puesto antes de que aprieten los de al lado. ¿Lo vemos en 10 minutos?\n\nJordi`;
  return `Hola, retomo lo de ${negocio}: mantener el puesto en Google cuesta menos que recuperarlo, y es justo lo que hacemos. ¿Lo vemos 10 minutos?\n\nJordi`;
}

// ── VARIANTES del email inicial (experimento A/B) ──────────────────────────
// Todas humanas, cortas y honestas (datos reales). El sistema las rota y el panel
// mide cuál saca más respuestas. v1 = subject/bodyText de arriba.

// v2 — curiosidad / pregunta directa
function subject2(f, negocio, ciudad) {
  const comp = whoNamed(f);
  return comp ? `¿sabías que ${comp} sale antes que tú en Google?` : `una cosa de cómo sale ${tidy(negocio, 30)} en Google`;
}
function body2(f, negocio, ciudad) {
  const search = f.primarySearch || `lo tuyo en ${ciudad}`;
  const comp = whoNamed(f);
  const behind = isBehind(f) || (f.bestCompetitor && f.reviews < f.bestCompetitor.reviews * 0.7);
  const intro = hookLines(f);
  if (behind) {
    const quien = comp ? `${comp} y otros` : "otros negocios de la zona";
    return [`Hola,`, ``, ...intro, `Una pregunta rápida: ¿sabías que cuando buscan «${search}» en Google, ${negocio} sale bastante abajo y ${quien} se llevan las llamadas?`, ``, `Te he preparado un informe de una página con cómo estás y qué cambiaría. ¿Te lo enseño en 10 minutos?`, ``, `Un saludo,`, `Jordi · Faro`].join("\n");
  }
  return [`Hola,`, ``, ...intro, `Una pregunta rápida sobre ${negocio}: en Google sales bastante bien, pero hay un par de detalles de la ficha que aseguran el puesto antes de que aprieten los de al lado.`, ``, `Te paso un informe de una página con lo que vi. ¿Lo vemos en 10 minutos?`, ``, `Un saludo,`, `Jordi · Faro`].join("\n");
}

// v3 — ultra breve (3 líneas)
function subject3(f, negocio, ciudad) { return `10 minutos para subir ${tidy(negocio, 30)} en Google`; }
function body3(f, negocio, ciudad) {
  const search = f.primarySearch || `lo tuyo en ${ciudad}`;
  const comp = whoNamed(f);
  const behind = isBehind(f) || (f.bestCompetitor && f.reviews < f.bestCompetitor.reviews * 0.7);
  const h = hasHook(f) ? `${f.hook} ` : "";
  const sale = hasHook(f) ? "cómo sales" : `cómo sale ${negocio}`;
  if (behind) {
    const quien = comp ? `por debajo de ${comp}` : "por debajo de otros de la zona";
    return `Hola, ${h}vi ${sale} en Google cuando buscan «${search}» y hay margen claro para subir (ahora apareces ${quien}). Te paso un informe de una página con cómo estás; ¿lo vemos en 10 min?\n\nJordi · Faro`;
  }
  return `Hola, ${h}vi ${sale} en Google y estás bien, pero con un par de ajustes aseguras el puesto. Te paso un informe de una página; ¿lo vemos en 10 min?\n\nJordi · Faro`;
}

export const VARIANTS = [
  { id: "v1", nombre: "humano corto", subject, body: bodyText },
  { id: "v2", nombre: "pregunta/curiosidad", subject: subject2, body: body2 },
  { id: "v3", nombre: "ultra breve", subject: subject3, body: body3 },
];
export const variantById = (id) => VARIANTS.find((v) => v.id === id) || VARIANTS[0];

// Mensaje de WhatsApp (sin emojis — salen raros). Un pelín más largo que antes:
// menciona 1-2 problemas REALES de sus datos para captar la atención.
// WhatsApp: CORTO y CONCRETO (estilo "busqué X y sale tu competencia, tú no").
// Sin emojis. Usa datos reales: el competidor que sale por delante + la búsqueda.
export function waText(f, negocio, ciudad) {
  const behind = f.posMeasured && f.businessVisibility != null && f.competitorVisibility != null && f.businessVisibility < f.competitorVisibility - 8;
  const search = f.primarySearch || ciudad;
  const comp = f.bestCompetitor && f.compNamed && f.bestCompetitor.name;
  let hook, why;
  if (behind && comp) {
    hook = `Busqué «${search}» en Google y me salen ${comp} y otros por delante; a vuestra ficha hay que ir a buscarla.`;
    why = `Y ahí es donde se reparten las llamadas: quien busca y no os ve, acaba yendo a ellos.`;
  } else if (behind) {
    hook = `Busqué «${search}» en Google y no salís arriba, que es justo donde se reparten las llamadas.`;
    why = `Quien os busca y no os encuentra en los primeros, acaba llamando al de al lado.`;
  } else if (comp && f.bestCompetitor.reviews && f.reviews < f.bestCompetitor.reviews) {
    hook = `Busqué «${search}» en Google y ${comp} os saca distancia: ${f.bestCompetitor.reviews} reseñas frente a vuestras ${f.reviews}.`;
    why = `Google usa eso para decidir a quién enseña primero, así que os pueden adelantar en nada.`;
  } else {
    hook = `Le he echado un ojo a cómo aparecéis en Google en ${ciudad} y hay competencia que os sale por delante cuando os buscan.`;
    why = `Esos son clientes que acaban yendo a ellos en vez de a vosotros.`;
  }
  return `Hola ${negocio}, soy Jordi. ${hook} ${why} Os hice un análisis rápido de por qué pasa y cómo darle la vuelta, ¿os lo paso?`;
}

// Sin datos del audit: misma idea, un pelín más de cuerpo.
export function waTextGeneric(negocio, ciudad) {
  return `Hola ${negocio}, soy Jordi. Busqué cómo aparecéis en Google en ${ciudad} y hay competencia que os sale por delante cuando os buscan; esos son clientes que acaban yendo a ellos en vez de a vosotros. Os hice un análisis rápido de por qué pasa y cómo adelantarlos, ¿os lo paso?`;
}

// Mensaje de Instagram DM (para copiar/pegar) — personalizado y de "value-first".
// Ángulo honesto: tienen IG pero NO web → invisibles en Google, pierden clientes.
const IG_COMPLIMENT = {
  estetica: "lo que hacéis de estética", peluqueria: "vuestro trabajo de peluquería",
  unas: "los diseños de uñas que subís", barberia: "los cortes que subís",
  tatuajes: "los tatuajes que hacéis", pilates: "vuestras clases",
  fisioterapia: "cómo cuidáis a vuestros pacientes", restaurante: "vuestra comida",
  cafeteria: "vuestro café", floristeria: "vuestros ramos", ropa: "lo que tenéis en la tienda",
};
export function igText(b) {
  const c = IG_COMPLIMENT[b.vertical] || "lo que hacéis";
  const r = Number(b.reviews) || 0;
  const social = r >= 100 ? ` (${r} reseñas en Google, casi nada 👏)` : r >= 30 ? ` — se nota que la gente os quiere (${r} reseñas)` : "";
  return [
    `¡Hola ${b.negocio}! 👋 Os he descubierto por ${b.ciudad} y me ha encantado ${c}${social}.`,
    `Una cosa que me llamó la atención: he visto que no tenéis web. Eso significa que cuando alguien os busca en Google —que es donde busca casi todo el mundo antes de ir— no aparecéis, y dependéis 100% de que os encuentren por aquí. Se os escapan clientes que ni saben que existís.`,
    `Me dedico a montar webs y a posicionar negocios como el vuestro en Google, y os he preparado un mini-análisis gratis de cómo estáis (y cómo se arregla). ¿Os lo enseño? Sin compromiso 🙌`,
  ].join("\n\n");
}

// ── Proyección compacta del audit → findings (la usa audit-batch al guardar JSON) ──
// Incluye un índice de VISIBILIDAD (0-100) del negocio y de la competencia,
// derivado de las posiciones reales en el Map Pack con una curva tipo CTR.
const rankVis = (r) => (r == null ? 0 : r <= 1 ? 100 : r <= 2 ? 86 : r <= 3 ? 66 : r <= 4 ? 48 : r <= 5 ? 38 : r <= 10 ? 20 : r <= 20 ? 8 : 3);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
// ¿Nombre genérico (solo categoría, sin marca)? p.ej. "Estética y peluquería" → lo saltamos.
const GENERIC_TOK = new Set(["estetica", "peluqueria", "dental", "dentista", "clinica", "centro", "centre", "fisioterapia", "fisio", "salon", "belleza", "medicina", "medico", "unas", "barberia", "pilates", "yoga", "spa", "odontologia", "odontologica", "nails", "beauty", "hair", "studio", "y", "de", "la", "el", "los", "las", "del", "con", "para", "i"]);
const stripAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
function isGenericName(n) { const t = stripAccents(n).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean); return !t.length || t.every((x) => GENERIC_TOK.has(x) || x.length <= 2); }

export function projectFindings(audit) {
  const positions = (audit.positions || []).filter((p) => !p.error);
  const posMeasured = !!(audit.mapPackReal && positions.length);
  const bizRanks = positions.map((p) => p.business); // puede incluir null (no rankeado)
  const ranked = bizRanks.filter((v) => v != null);
  const avgPos = ranked.length ? Math.round(avg(ranked)) : null;
  const businessVisibility = posMeasured ? Math.round(avg(bizRanks.map(rankVis))) : null;
  const compRanks = positions.flatMap((p) => (p.competitors || []).map((c) => c.pos)).filter((v) => v != null);
  const competitorVisibility = compRanks.length ? Math.round(avg(compRanks.map(rankVis))) : posMeasured ? 86 : null;
  // Competidor a nombrar: el de más reseñas con NOMBRE PROPIO (salta genéricos); si todos genéricos, el mejor.
  const comps = (audit.competitors || []).slice().sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  const bc = comps.find((c) => c.name && !isGenericName(c.name)) || comps[0] || audit.bestCompetitor || null;
  return {
    reviews: audit.business?.reviews ?? 0,
    rating: audit.business?.rating ?? null,
    bestCompetitor: bc ? { name: bc.name, reviews: bc.reviews, rating: bc.rating ?? null } : null,
    compNamed: bc ? !isGenericName(bc.name) : false,
    posMeasured,
    avgPos,
    businessRanked: ranked.length > 0,
    businessVisibility,
    competitorVisibility,
    speed: audit.speed?.score ?? null,
    photos: audit.gbp?.photosCount ?? null,
    hasHours: !!audit.gbp?.hasHours,
    quickWins: (audit.quickWins || []).map((q) => ({ title: q.title, detail: q.detail })),
    primarySearch: audit.searches?.[0] || null,
    category: audit.business?.category ?? null,
    webReachable: audit.web?.reachable ?? null,
    coldMode: !!audit.coldMode,
    hook: null, hookGeneric: true, hookBasis: null,
  };
}
