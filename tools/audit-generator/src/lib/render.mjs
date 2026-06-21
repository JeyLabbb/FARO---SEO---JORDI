// render.mjs — pinta el objeto de auditoría como Markdown (siguiendo
// 02-plantilla-auditoria.md, para uso interno) y como HTML/PDF de varias páginas
// diseñado para ENVIAR al cliente (premium). Réplica del informe de Jorge (GEO)
// adaptada a SEO local: portada+score · prueba (tabla) · competencia (barras)
// + diagnóstico · plan + CTA.
//
// Honestidad (regla del proyecto): los campos que la Places API NO da se marcan
// "a mano" en neutro. Cifras REALES; el rojo es señal de alarma, no decoración.
import { BRAND } from "../config.mjs";

function pos(n) { return n == null ? "—" : `≈ ${n}`; }
function yn(v) { return v ? "Sí" : "No"; }
function fmtRating(r, n) { if (r == null) return `${n ?? 0} reseñas`; return `${n ?? 0} reseñas · ${r.toFixed(1)} ⭐`; }

export function renderMarkdown(a) {
  const b = a.business;
  const g = a.gbp;
  const maps = g.mapsUri ? ` ([ver ficha](${g.mapsUri}))` : "";
  const compNames = a.competitors.map((c) => c.name);
  const compHead = compNames.map((n) => `${n}`).join(" | ");
  const posRows = a.positions.map((p) => { const comps = p.competitors.map((c) => pos(c.pos)).join(" | "); return `| ${p.query} | **${pos(p.business)}** | ${comps} |`; }).join("\n");
  const speedTxt = a.speed.score != null ? `${a.speed.score} / 100` : `no medido (${a.speed.error || "sin web"})`;
  const quickWins = a.quickWins.length ? a.quickWins.map((q, i) => `${i + 1}. **${q.title}** — ${q.detail}`).join("\n") : "_No se detectaron quick wins automáticos; revisar a mano._";
  const secondary = g.secondaryTypes.length ? g.secondaryTypes.slice(0, 6).join(", ") : "—";
  return `# Auditoría de presencia local — ${b.name}

> Análisis con **datos públicos** (Google Places API + PageSpeed). \
${a.mapPackReal ? "Posición **real** del Map Pack de Google (vía DataForSEO)" : "Posiciones **aproximadas** (orden de Places)"}. \
Generado: ${a.generatedAt.toISOString().slice(0, 10)}.

## Datos del negocio
- **Nombre:** ${b.name}
- **Ciudad / zona:** ${a.brief.city || "Pamplona"}
- **Web:** ${a.web.url ? `[${a.web.url}](${a.web.url})` : "—"}
- **Búsquedas objetivo:** ${a.searches.join(" · ") || "—"}
- **Competidores de referencia:** ${compNames.join(" · ") || "—"}

## 1. Posición en el Map Pack
| Búsqueda | Tu posición | ${compHead || "Competidores"} |
|---|---|${"---|".repeat(Math.max(compNames.length, 1))}
${posRows || "| _sin búsquedas_ |  |  |"}

## 2. Ficha de Google${maps}
- **Categoría:** ${g.category || "—"} · **Fotos:** ${g.photosCount} · **Horario:** ${yn(g.hasHours)}
- **Reseñas:** ${g.reviews} · nota ${g.rating != null ? g.rating.toFixed(1) + " ⭐" : "—"}

## 3. Reseñas vs el mejor competidor
- **Tú:** ${fmtRating(g.rating, g.reviews)} · **Líder:** ${a.bestCompetitor ? `${a.bestCompetitor.name} — ${fmtRating(a.bestCompetitor.rating, a.bestCompetitor.reviews)}` : "—"}
- **Lectura:** ${reviewReading(a)}

## 4. SEO local de la web
- **Schema:** ${a.web.url ? yn(a.web.hasLocalBusinessSchema) : "—"} · **Keyword local:** ${a.web.url ? yn(a.web.hasLocalKeywordInTitleOrH1) : "—"} · **Velocidad:** ${speedTxt}

## 5. Quick wins
${quickWins}
${a.notes.length ? `\n---\n${a.notes.map((n) => `- ${n}`).join("\n")}` : ""}
`;
}

function reviewReading(a) {
  const g = a.gbp;
  if (!a.bestCompetitor) return "Sin competidor de referencia para comparar.";
  const diff = a.bestCompetitor.reviews - g.reviews;
  if (diff > 0) return `Te faltan ~${diff} reseñas para igualar al líder. La cantidad y recencia pesan en el ranking.`;
  if (g.rating != null && a.bestCompetitor.rating != null && g.rating < a.bestCompetitor.rating) return `Vas por delante en cantidad pero el líder tiene mejor nota.`;
  return "Vas por delante del competidor de referencia. Mantener el ritmo.";
}

// ───────────────────────────── HTML (cliente) ─────────────────────────────
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const short = (s, n = 22) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

// Informe de 4 páginas — diseño FIJO estilo Jorge, personalizado con datos REALES.
export function renderHtml(a) {
  const g = a.gbp;
  const hasWeb = Boolean(a.web.url);
  const webOk = hasWeb && a.web.reachable;
  const spv = a.speed.score;

  const bizPos = a.positions.map((p) => p.business).filter((n) => n != null);
  const avgPos = bizPos.length ? Math.round(bizPos.reduce((x, y) => x + y, 0) / bizPos.length) : null;
  const posMeasured = a.mapPackReal && a.positions.some((p) => !p.error);
  const hasApproxPos = a.positions.some((p) => !p.error && p.business != null);
  // En modo cold (sin DataForSEO) las posiciones son APROXIMADAS (orden de Places):
  // mostramos visibilidad pero etiquetada "estimada". En warm estimated=false → idéntico a siempre.
  const estimated = !a.mapPackReal && hasApproxPos;
  const showVis = posMeasured || estimated;
  const rankVis = (r) => (r == null ? 0 : r <= 1 ? 100 : r <= 2 ? 86 : r <= 3 ? 66 : r <= 4 ? 48 : r <= 5 ? 38 : r <= 10 ? 20 : r <= 20 ? 8 : 3);
  const visBiz = a.positions.filter((p) => !p.error).map((p) => rankVis(p.business));
  const visibility = showVis && visBiz.length ? Math.round(visBiz.reduce((x, y) => x + y, 0) / visBiz.length) : null;
  const visCompVals = a.positions.flatMap((p) => (p.competitors || []).map((c) => rankVis(c.pos))).filter(Boolean);
  const compVis = visCompVals.length ? Math.round(visCompVals.reduce((x, y) => x + y, 0) / visCompVals.length) : 80;

  const visCls = visibility == null ? "na" : visibility >= 80 ? "good" : visibility >= 60 ? "warn" : "bad";
  const posCls = avgPos == null ? (showVis ? "bad" : "na") : avgPos <= 3 ? "good" : avgPos <= 4 ? "warn" : "bad";
  const spCls = spv == null ? "na" : spv >= 90 ? "good" : spv >= 50 ? "warn" : "bad";
  // Puntuación de SEO local (0-100) con señales 100% verificables (reseñas, ficha, web).
  // Pinta el donut cuando NO hay posición fiable (lo normal en cold) → la portada nunca
  // queda vacía ni muestra "s/d". En warm (hasPos siempre true) no cambia nada.
  const revRatio = (a.bestCompetitor && a.bestCompetitor.reviews) ? Math.min(1, (g.reviews || 0) / a.bestCompetitor.reviews) : ((g.reviews || 0) >= 50 ? 1 : (g.reviews || 0) / 50);
  const health = Math.round(100 * (0.35 * revRatio + 0.15 * Math.min(1, (g.photosCount || 0) / 10) + 0.20 * (spv != null ? spv / 100 : 0.5) + 0.10 * (g.hasHours ? 1 : 0) + 0.12 * (a.web.hasLocalBusinessSchema ? 1 : 0) + 0.08 * (a.web.hasLocalKeywordInTitleOrH1 ? 1 : 0)));
  const hasPos = showVis;
  const score = hasPos ? visibility : health;
  const scoreCls = score == null ? "na" : score >= 80 ? "good" : score >= 60 ? "warn" : "bad";
  const scoreColor = scoreCls === "good" ? "var(--green)" : scoreCls === "warn" ? "var(--amber)" : scoreCls === "na" ? "var(--faint)" : "var(--red)";
  const behind = showVis && visibility != null && visibility < compVis - 8;

  let vH, vS;
  if (avgPos != null && avgPos > 3) { vH = `El top-3 del mapa se lleva la mayoría de las llamadas. Tú apareces más abajo, donde casi nadie mira.`; vS = `No va de ser mejor o peor negocio: va de cómo está montada tu ficha de Google y tu SEO local.`; }
  else if (showVis && avgPos == null) { vH = `Cuando alguien te busca por la zona, no apareces en el mapa de Google. Esas llamadas se las llevan otros.`; vS = `Tiene arreglo, y depende de la ficha y del SEO local — justo lo que hacemos.`; }
  else if (visibility != null && visibility < 80) { vH = `Apareces a medias: te ven en ~${visibility}% de las búsquedas frente al ~${compVis}% de los que salen arriba.`; vS = `Esa diferencia son llamadas y reservas que hoy se van a la competencia.`; }
  else if (hasPos) { vH = `Apareces bien en Google, pero el mapa se mueve y la competencia aprieta.`; vS = `Hay un par de cosas de la ficha y del SEO local que afinaríamos para asegurar el puesto.`; }
  else if (a.bestCompetitor && a.bestCompetitor.reviews) { vH = `Quien sale primero en tu zona acumula ${a.bestCompetitor.reviews} reseñas; tú ${g.reviews}.`; vS = `Google ordena mucho por confianza, y por ahí se cuela la mayoría de las llamadas. Se trabaja con la ficha y el SEO local, que es justo lo nuestro.`; }
  else { vH = `Tu ficha de Google y tu SEO local tienen recorrido para ganar visibilidad en ${a.brief.city || "tu zona"}.`; vS = `Los negocios que Google enseña primero lo tienen más afinado. Eso se trabaja, y es lo que hacemos.`; }

  // Tabla (página 2)
  const comps = a.competitors;
  const posHead = comps.map((c) => `<th title="${esc(c.name)}">${esc(short(c.name, 15))}</th>`).join("");
  const posBody = a.positions.map((p) => {
    const tu = p.business == null ? "—" : `≈${p.business}`;
    const youBad = p.business == null || p.business > 3;
    const cells = comps.map((c) => { const f = p.competitors.find((x) => x.name === c.name); return `<td>${f && f.pos != null ? "≈" + f.pos : "—"}</td>`; }).join("");
    return `<tr><td class="q">${esc(p.query)}</td><td class="you ${youBad ? "bad" : ""}">${tu}</td>${cells}</tr>`;
  }).join("");

  // Barras (página 3): nº de búsquedas en las que cada uno sale en el top-3.
  const tally = new Map();
  for (const p of a.positions) { if (p.error) continue; for (const c of (p.competitors || [])) { if (c.pos != null && c.pos <= 3) { const nm = short(c.name, 26); tally.set(nm, (tally.get(nm) || 0) + 1); } } }
  const youN = a.positions.filter((p) => !p.error && p.business != null && p.business <= 3).length;
  const measured = Math.max(1, a.positions.filter((p) => !p.error).length);
  let bars = [...tally.entries()].map(([name, n]) => ({ name, n, you: false }));
  bars.push({ name: short(a.business.name, 26), n: youN, you: true });
  bars.sort((x, y) => y.n - x.n);
  bars = bars.slice(0, 7);
  const maxN = Math.max(measured, ...bars.map((b) => b.n), 1);
  const barsHtml = bars.map((b) => `<div class="bar-row"><span class="bar-name ${b.you ? "you" : ""}">${esc(b.name)}${b.you ? " (tú)" : ""}</span><span class="bar-track"><span class="bar-fill ${b.you ? "you" : ""}" style="width:${Math.max((b.n / maxN) * 100, 3)}%"></span></span><span class="bar-n ${b.you ? "you" : ""}">${b.n}</span></div>`).join("");

  // Diagnóstico (página 3): 4 tarjetas, todas reales.
  const diag = [];
  if (avgPos != null && avgPos > 3) diag.push(["Fuera del top-3", `Sales sobre la posición ≈${avgPos}. El top-3 del mapa se lleva la mayoría de las llamadas; por debajo, casi nadie mira.`]);
  else if (showVis && avgPos == null) diag.push(["No sales en el mapa", `Para esas búsquedas no apareces en el top-20. Ese cliente se lo lleva la competencia.`]);
  if (behind) diag.push(["Te sacan en visibilidad", `Los de arriba acaparan ~${compVis}% de la visibilidad de la zona; tú te quedas en ~${visibility}%.`]);
  if (spv != null && spv < 90) diag.push(["Tu web va lenta", `${spv}/100 en móvil. Google usa la velocidad para ordenar, y de paso espanta visitas.`]);
  diag.push(["No va de ser mejor", `Depende de cómo está montada tu ficha de Google y tu SEO local, no de ser mejor o peor negocio. Eso se trabaja.`]);
  diag.push(["Y se mueve solo", `El mapa de Google cambia constantemente. Lo que hoy va flojo, sin trabajo continuo va a peor.`]);
  if (!showVis && a.bestCompetitor && a.bestCompetitor.reviews) diag.unshift(["Te sacan en reseñas", `El referente de tu zona tiene ${a.bestCompetitor.reviews} reseñas; tú ${g.reviews}. Es la señal nº1 que Google mira para ordenar el mapa.`]);
  const diagHtml = diag.slice(0, 4).map(([t, d]) => `<div class="dcard"><p class="dt">${esc(t)}</p><p class="dd">${esc(d)}</p></div>`).join("");

  // Plan (página 4)
  const plan = (a.quickWins.length ? a.quickWins.slice(0, 3) : [{ title: "Optimizar la ficha de Google", detail: "Categorías, servicios y descripción para las búsquedas que traen clientes." }, { title: "Reseñas constantes", detail: "Un sistema para pedir reseña a cada cliente." }, { title: "SEO local de la web", detail: "Schema, NAP y velocidad para que Google te tenga claro." }]);
  const planHtml = plan.map((q, i) => `<li class="move"><span class="mv-n">${i + 1}</span><div><p class="mv-t">${esc(q.title)}</p><p class="mv-d">${esc(q.detail)}</p></div></li>`).join("");

  const dateStr = a.generatedAt.toISOString().slice(0, 10);
  const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const monthYear = `${MES[a.generatedAt.getMonth()]} ${a.generatedAt.getFullYear()}`;
  const cityEsc = esc(a.brief.city || "tu zona");
  const searchEsc = esc((a.searches && a.searches[0]) || "lo tuyo");
  const webShort = a.web.url ? esc(a.web.url.replace(/^https?:\/\//, "").replace(/\/$/, "")) : "";
  // Comparativa por RESEÑAS (dato real y verificable) para la variante sin posición fiable.
  const allByReviews = [{ name: a.business.name, reviews: g.reviews || 0, rating: g.rating, you: true }]
    .concat(comps.map((c) => ({ name: c.name, reviews: c.reviews || 0, rating: c.rating, you: false })))
    .sort((x, y) => y.reviews - x.reviews);
  const maxR = Math.max(1, ...allByReviews.map((r) => r.reviews));
  const revBarsHtml = allByReviews.slice(0, 7).map((b) => `<div class="bar-row"><span class="bar-name ${b.you ? "you" : ""}">${esc(short(b.name, 26))}${b.you ? " (tú)" : ""}</span><span class="bar-track"><span class="bar-fill ${b.you ? "you" : ""}" style="width:${Math.max((b.reviews / maxR) * 100, 2)}%"></span></span><span class="bar-n ${b.you ? "you" : ""}">${b.reviews}</span></div>`).join("");
  const cmpRows = allByReviews.slice(0, 5).map((b) => `<tr><td class="q">${esc(short(b.name, 28))}${b.you ? " (tú)" : ""}</td><td class="you ${b.you && a.bestCompetitor && b.reviews < a.bestCompetitor.reviews * 0.7 ? "bad" : ""}">${b.reviews}</td><td>${b.rating != null ? b.rating.toFixed(1) + " ★" : "—"}</td></tr>`).join("");
  const leaderRev = a.bestCompetitor ? a.bestCompetitor.reviews : (allByReviews[0] && !allByReviews[0].you ? allByReviews[0].reviews : null);
  const revMult = (leaderRev && g.reviews) ? Math.round(leaderRev / Math.max(1, g.reviews)) : null;
  const CIRC = 2 * Math.PI * 54;
  const dash = score != null ? CIRC * (1 - score / 100) : CIRC;
  const foot = (n) => `<div class="foot"><span>Informe de visibilidad en Google — ${esc(a.business.name)}</span><span>${esc(BRAND)} · ${n}/4</span></div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe de visibilidad — ${esc(a.business.name)} · ${esc(BRAND)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{ --ink:#16151A; --mut:#6A6770; --faint:#9A97A1; --line:#E9E7EC; --red:#DC2330; --amber:#C9780A; --green:#1C8A5B; }
  *{ box-sizing:border-box; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ margin:0; background:#EDECEF; color:var(--ink); font-family:"Hanken Grotesk",system-ui,sans-serif; font-size:16px; line-height:1.6; }
  .page{ background:#fff; max-width:880px; margin:0 auto; padding:56px 62px; display:flex; flex-direction:column; min-height:1245px; }
  .body{ flex:1; display:flex; flex-direction:column; justify-content:center; }

  .top{ display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--faint); padding-bottom:22px; border-bottom:1px solid var(--line); }
  .top .bk{ letter-spacing:.24em; font-weight:800; color:var(--ink); }
  .head .eyebrow{ margin:0; }
  .eyebrow{ margin:0; font-size:12.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--faint); font-weight:700; }
  h1{ margin:12px 0 14px; font-size:60px; line-height:1.0; font-weight:800; letter-spacing:-.025em; color:var(--ink); }
  h2{ margin:10px 0 10px; font-size:42px; line-height:1.04; font-weight:800; letter-spacing:-.02em; color:var(--ink); }
  .sub{ margin:0; font-size:18.5px; color:var(--mut); max-width:92%; }
  .grp{ display:flex; flex-direction:column; }

  .hero{ display:flex; gap:40px; align-items:center; }
  .donut{ position:relative; flex:0 0 auto; width:188px; height:188px; }
  .donut .n{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .donut .nv{ font-size:60px; font-weight:800; line-height:1; }
  .donut .nl{ font-size:13px; color:var(--faint); margin-top:5px; }
  .hero-h{ font-size:27px; font-weight:700; line-height:1.32; margin:0 0 14px; letter-spacing:-.01em; }
  .hero-s{ font-size:17px; color:var(--mut); margin:0; line-height:1.6; }

  .cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  .card{ border:1px solid var(--line); border-radius:18px; padding:26px 28px; }
  .card-n{ font-size:54px; font-weight:800; line-height:1; letter-spacing:-.02em; }
  .card-n.bad{ color:var(--red); } .card-n.warn{ color:var(--amber); } .card-n.good{ color:var(--green); } .card-n.na{ color:var(--faint); }
  .card-l{ font-size:14.5px; color:var(--mut); margin-top:14px; line-height:1.45; }

  table.t{ width:100%; border-collapse:collapse; font-size:19px; }
  table.t th{ font-size:12.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--faint); font-weight:700; text-align:center; padding:0 10px 18px; }
  table.t th:first-child{ text-align:left; }
  table.t td{ padding:26px 10px; text-align:center; border-top:1px solid var(--line); color:var(--mut); }
  table.t td.q{ text-align:left; color:var(--ink); font-weight:500; }
  table.t td.you{ font-weight:800; color:var(--green); } table.t td.you.bad{ color:var(--red); }
  .takeaway{ margin-top:26px; border:1px solid var(--line); border-left:4px solid var(--ink); border-radius:12px; padding:20px 24px; font-size:19px; font-weight:600; }
  .takeaway b{ font-weight:800; } .takeaway b.bad{ color:var(--red); }
  .leg{ font-size:13px; color:var(--faint); margin-top:16px; }

  .bars{ margin-top:6px; }
  .bar-row{ display:grid; grid-template-columns:250px 1fr 34px; align-items:center; gap:16px; padding:15px 0; }
  .bar-name{ font-size:17px; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bar-name.you{ color:var(--red); font-weight:700; }
  .bar-track{ height:34px; background:#F2F1F4; border-radius:8px; overflow:hidden; }
  .bar-fill{ display:block; height:100%; background:var(--ink); border-radius:8px; }
  .bar-fill.you{ background:var(--red); }
  .bar-n{ font-size:18px; font-weight:800; color:var(--mut); text-align:right; } .bar-n.you{ color:var(--red); }

  .diag{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:10px; }
  .dcard{ border:1px solid var(--line); border-radius:18px; padding:26px 28px; }
  .dt{ margin:0 0 8px; font-weight:800; font-size:20px; }
  .dd{ margin:0; font-size:15.5px; color:var(--mut); line-height:1.55; }

  .moves{ list-style:none; margin:6px 0 0; padding:0; }
  .move{ display:flex; gap:20px; padding:26px 0; border-top:1px solid var(--line); }
  .move:first-child{ border-top:none; }
  .mv-n{ flex:0 0 auto; width:46px; height:46px; border-radius:12px; background:#F2F1F4; color:var(--ink); font-weight:800; display:flex; align-items:center; justify-content:center; font-size:22px; }
  .mv-t{ font-weight:800; margin:0 0 6px; font-size:22px; } .mv-d{ margin:0; color:var(--mut); font-size:16px; line-height:1.55; }

  .ctabox{ margin-top:14px; background:var(--ink); border-radius:20px; padding:38px 42px; color:#F4F2ED; }
  .ctabox h3{ margin:0 0 12px; font-size:30px; font-weight:800; letter-spacing:-.015em; color:#fff; line-height:1.15; }
  .ctabox p{ margin:0; font-size:17.5px; color:#C9C7CE; line-height:1.6; }
  .ctabox .who{ margin-top:22px; padding-top:20px; border-top:1px solid rgba(255,255,255,.14); font-size:15.5px; color:#B6B4BC; }
  .ctabox .who b{ color:#fff; font-weight:700; }

  .foot{ display:flex; justify-content:space-between; gap:16px; margin-top:30px; padding-top:16px; border-top:1px solid var(--line); font-size:12px; color:var(--faint); }

  @media screen{ .page{ margin:24px auto; border-radius:6px; box-shadow:0 22px 55px -30px rgba(0,0,0,.3); } }
  @page{ size:A4; margin:0; }
  @media print{ body{ background:#fff; } .page{ margin:0; max-width:none; border-radius:0; min-height:auto; padding:42px 48px; break-after:page; } .page:last-child{ break-after:auto; } .card,.dcard,.move,.bar-row,tr,.ctabox,.hero{ break-inside:avoid; } }
</style>
</head>
<body>

<section class="page p1">
  <div class="top"><span class="bk">${esc(BRAND)}</span><span>Informe gratuito · ${monthYear}</span></div>
  <div class="body">
    <p class="eyebrow">Informe de visibilidad en Google</p>
    <h1>${esc(a.business.name)}</h1>
    <p class="sub">Cuando alguien busca «${searchEsc}» en ${cityEsc}.</p>
    <div class="hero">
      <div class="donut">
        <svg viewBox="0 0 124 124" width="188" height="188">
          <circle cx="62" cy="62" r="54" fill="none" stroke="var(--line)" stroke-width="13"></circle>
          ${score != null ? `<circle cx="62" cy="62" r="54" fill="none" stroke="${scoreColor}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${dash.toFixed(1)}" transform="rotate(-90 62 62)"></circle>` : ""}
          <text x="62" y="59" text-anchor="middle" dominant-baseline="central" font-family="Hanken Grotesk, sans-serif" font-weight="800" font-size="37" fill="${scoreColor}">${score != null ? score : "s/d"}</text>
          <text x="62" y="83" text-anchor="middle" font-family="Hanken Grotesk, sans-serif" font-weight="600" font-size="10" fill="#9A97A1">${score != null ? "/ 100" : "sin datos"}</text>
        </svg>
      </div>
      <div><p class="hero-h">${vH}</p><p class="hero-s">${vS}</p></div>
    </div>
    <div class="cards">
      ${hasPos
        ? `<div class="card"><div class="card-n ${visCls}">${visibility != null ? visibility + "%" : "s/d"}</div><div class="card-l">de visibilidad en el mapa${estimated ? " (estimada)" : ""} · los de arriba ~${compVis}%</div></div>
      <div class="card"><div class="card-n ${posCls}">${avgPos != null ? "≈" + avgPos : "Fuera"}</div><div class="card-l">posición media en tus búsquedas clave</div></div>`
        : `<div class="card"><div class="card-n ${scoreCls}">${health}</div><div class="card-l">tu SEO local sobre 100 · ficha + reseñas + web</div></div>
      <div class="card"><div class="card-n ${a.bestCompetitor && g.reviews >= a.bestCompetitor.reviews * 0.7 ? "warn" : "bad"}">${g.reviews}${a.bestCompetitor ? `<span style="font-size:24px;color:var(--faint);font-weight:700"> / ${a.bestCompetitor.reviews}</span>` : ""}</div><div class="card-l">reseñas tuyas${a.bestCompetitor ? " vs el líder de tu zona" : ""}</div></div>`}
      <div class="card"><div class="card-n ${spCls}">${spv != null ? spv : "—"}</div><div class="card-l">velocidad de tu web en móvil (sobre 100)</div></div>
    </div>
  </div>
  ${foot(1)}
</section>

<section class="page">
  <div class="body">
    <p class="eyebrow">La prueba</p>
    ${hasPos ? `<h2>Dónde sales tú y dónde salen ellos</h2>
    <p class="sub">Búsquedas reales de tu zona en el mapa de Google. ${a.mapPackReal ? "Posiciones reales del Map Pack." : "Orden aproximado."} Verde = top-3 · rojo = hay que bajar a buscarte.</p>
    <table class="t">
      <thead><tr><th>Búsqueda</th><th>Tú</th>${posHead}</tr></thead>
      <tbody>${posBody || `<tr><td class="q">sin búsquedas</td><td class="you">—</td></tr>`}</tbody>
    </table>
    <div class="takeaway">De tus búsquedas clave, hoy sales en el top-3 en <b class="${youN <= 1 ? "bad" : ""}">${youN} de ${measured}</b>.</div>
    <p class="leg">«≈N» = posición en Google · «—» = fuera del top 20. El top-3 se lleva la inmensa mayoría de los clics del mapa.</p>` : `<h2>Tú y los referentes de tu zona</h2>
    <p class="sub">Comparado con los negocios que Google enseña primero cuando buscan «${searchEsc}» en ${cityEsc}.</p>
    <table class="t">
      <thead><tr><th>Negocio</th><th>Reseñas</th><th>Nota</th></tr></thead>
      <tbody>${cmpRows || `<tr><td class="q">sin datos</td><td class="you">—</td><td>—</td></tr>`}</tbody>
    </table>
    <div class="takeaway">${revMult && revMult >= 2 ? `El referente de tu zona tiene <b class="bad">${revMult}× tus reseñas</b> (${leaderRev} frente a ${g.reviews}).` : `Tienes <b>${g.reviews}</b> reseñas. La cantidad y la frecuencia pesan en cómo te ordena Google.`}</div>
    <p class="leg">Las reseñas (cantidad, nota y frecuencia) son la señal nº1 que Google usa para ordenar el mapa local.</p>`}
  </div>
  ${foot(2)}
</section>

<section class="page">
  <div class="body">
    <p class="eyebrow">La competencia</p>
    <h2>${hasPos ? "A quién saca Google primero en tu zona" : "Reseñas: tú frente a tu zona"}</h2>
    <p class="sub">${hasPos ? "Veces que cada negocio aparece en el top-3 del mapa en tus búsquedas clave." : "Número de reseñas en Google de cada negocio de tu zona. La señal nº1 del ranking local."}</p>
    <div class="bars">${hasPos ? barsHtml : revBarsHtml}</div>
    <p class="eyebrow sec-top">Diagnóstico</p>
    <h2 style="font-size:24px">Por qué pasa esto</h2>
    <div class="diag">${diagHtml}</div>
  </div>
  ${foot(3)}
</section>

<section class="page">
  <div class="body">
    <p class="eyebrow">El plan</p>
    <h2>Lo que más mueve la aguja</h2>
    <p class="sub">Lo que arreglaríamos primero, por orden de impacto.</p>
    <ul class="moves">${planHtml}</ul>
    <div class="ctabox">
      <h3>Hacemos que ${esc(a.business.name)} suba en Google.</h3>
      <p>Montamos la ficha, las reseñas y el SEO local, lo trabajamos cada mes, y te damos un panel donde ves cómo subes — búsqueda a búsqueda.</p>
      <div class="who"><b>Jordi · ${esc(BRAND)}</b> — responde a este informe y te enseño el plan en 10 minutos.</div>
    </div>
  </div>
  ${foot(4)}
</section>

</body>
</html>`;
}
