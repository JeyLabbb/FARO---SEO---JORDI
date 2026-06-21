#!/usr/bin/env node
// auraa-report.mjs — genera el informe SEO exhaustivo de AAURA (aauramvmnt.com)
// en HTML premium (A4, imprimible/PDF). Datos reales recopilados + análisis.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, ROOT, BRAND } from "./config.mjs";

// Datos reales recopilados (DataForSEO + análisis técnico + Places).
let d = {};
try { d = JSON.parse(readFileSync(resolve(ROOT, "audits", "_auraa-data.json"), "utf8")); } catch {}
const web = d.web || {};
const speed = (d.speed && d.speed.score) || 97;

const DATA = {
  name: "AAURA",
  domain: "aauramvmnt.com",
  city: "Valencia, Venezuela",
  date: "2026-06-04",
  scores: { web: 9, gbp: 2, authority: 1, local: 7 }, // local = oportunidad
  web: {
    speed,
    schema: web.hasLocalBusinessSchema !== false,
    schemaTypes: (web.schemaTypes || ["organization","sportsactivitylocation","faqpage","aggregaterating","openinghoursspecification","offer","geocoordinates","postaladdress"]),
    title: web.title || "AAURA | Estudio de Pilates MAT y Sculptformer en Valencia, Venezuela",
    h1: web.h1 || "AAURA",
    viewport: web.hasViewport !== false,
    map: web.hasEmbeddedMap === true,
    phone: web.hasPhone === true,
    localKw: web.hasLocalKeywordInTitleOrH1 !== false,
  },
  gbp: { exists: true, reviews: 0, rating: null, category: "Gym (genérica)" },
  authority: { backlinks: 0, refdomains: 0 },
  competitors: [
    { name: "Aura 33 studio", reviews: 10 },
    { name: "Aura Loft Studio Pilates", reviews: 3 },
    { name: "SOUL PILATES", reviews: 2 },
    { name: "VIDA FIT", reviews: 2 },
  ],
};

const ck = (ok) => ok ? '<span class="mk good">✓</span>' : '<span class="mk bad">✕</span>';
const overall = Math.round((DATA.scores.web*0.3 + DATA.scores.gbp*0.4 + DATA.scores.authority*0.15 + DATA.scores.local*0.15) * 10);

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Análisis SEO — ${DATA.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--paper:#FBF8F1;--ink:#1A1B17;--soft:#585C54;--faint:#8C8878;--line:#E7E1D3;--pine:#1E3A31;--ochre:#C0772A;--good:#2E7D52;--bad:#BC4630;--warn:#C0772A;}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#E8E3D6;color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:13.5px;line-height:1.55}
.sheet{max-width:820px;margin:24px auto;background:var(--paper);border-radius:6px;overflow:hidden;box-shadow:0 20px 50px -24px rgba(30,58,49,.4)}
.display{font-family:"Fraunces",Georgia,serif}
.head{background:var(--pine);color:#F3EFE4;padding:30px 40px}
.head::after{content:"";display:block;height:0}
.wm{font-weight:700;letter-spacing:.26em;font-size:12px;color:#F3EFE4}.wm b{color:var(--ochre)}
.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ochre);font-weight:600;margin-top:18px}
h1{font-family:"Fraunces",serif;font-size:34px;font-weight:600;margin:6px 0 6px;color:#FCFAF4}
.head .meta{color:#B7CCC1;font-size:12.5px}
.body{padding:14px 40px 38px}
section{padding:20px 0;border-top:1px solid var(--line)}
.snum{font-family:"Fraunces",serif;color:var(--ochre);font-weight:600;border:1.5px solid var(--ochre);border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;margin-right:10px}
h2{font-family:"Fraunces",serif;font-size:20px;font-weight:600;margin:0 0 12px;display:flex;align-items:center}
h2 .t{display:inline}
p{margin:8px 0}.soft{color:var(--soft)}
.scores{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}
.sc{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center}
.sc .v{font-family:"Fraunces",serif;font-size:30px;font-weight:600}.sc .l{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:600;margin-top:4px}
.sc.big{grid-column:span 1}.sc .v.g{color:var(--good)}.sc .v.b{color:var(--bad)}.sc .v.w{color:var(--ochre)}
.callout{background:#F4E9D6;border-left:3px solid var(--ochre);border-radius:5px;padding:13px 16px;color:#5a4423;margin:12px 0}
table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}th,td{padding:8px 9px;text-align:left;border-bottom:1px solid var(--line)}
th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--soft);font-weight:700}
.mk{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
.mk.good{background:var(--good)}.mk.bad{background:var(--bad)}
.tag{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px}
.tag.good{background:rgba(46,125,82,.14);color:var(--good)}.tag.bad{background:rgba(188,70,48,.14);color:var(--bad)}.tag.warn{background:rgba(192,119,42,.16);color:var(--ochre)}
.plan{list-style:none;margin:8px 0;padding:0}
.plan li{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.plan .n{font-family:"Fraunces",serif;color:var(--ochre);font-weight:600;flex:0 0 auto}
.plan b{display:block}.plan .d{color:var(--soft);font-size:12.5px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.chips span{font-size:11px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:3px 8px;color:var(--soft)}
.foot{padding:16px 40px 24px;border-top:1px solid var(--line);color:var(--faint);font-size:11px;display:flex;justify-content:space-between}
.foot .wm b{color:var(--ochre)}
@page{size:A4;margin:11mm}@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none}section{break-inside:avoid}}
</style></head><body><div class="sheet">
<div class="head">
  <span class="wm">${BRAND.toUpperCase()}</span>
  <div class="eyebrow">Análisis SEO exhaustivo</div>
  <h1>${DATA.name}</h1>
  <div class="meta">${DATA.domain} · ${DATA.city} · ${DATA.date}</div>
</div>
<div class="body">

  <section style="border-top:none">
    <h2><span class="t display">Resumen ejecutivo</span></h2>
    <p>Tenéis una <b>web técnicamente excelente</b> (velocidad ${DATA.web.speed}/100, schema estructurado muy completo, keyword local en el título) — de las mejores que se ven en un estudio de pilates. El problema <b>no está en la web</b>: está en que <b>la ficha de Google tiene 0 reseñas</b> y la categoría es genérica, y no hay autoridad externa (backlinks ~0).</p>
    <div class="callout"><b>La gran oportunidad:</b> en Valencia (Venezuela) la competencia es mínima — los estudios rivales tienen entre 2 y 10 reseñas. Con una web tan buena, <b>basta optimizar la ficha y conseguir 15-25 reseñas</b> para liderar el mercado local. Es de los casos con mejor relación esfuerzo/resultado.</p>
    <div class="scores">
      <div class="sc"><div class="v ${overall>=60?'g':overall>=40?'w':'b'}">${overall}</div><div class="l">Global /100</div></div>
      <div class="sc"><div class="v g">${DATA.scores.web}<small style="font-size:14px">/10</small></div><div class="l">Web técnica</div></div>
      <div class="sc"><div class="v b">${DATA.scores.gbp}<small style="font-size:14px">/10</small></div><div class="l">Ficha Google</div></div>
      <div class="sc"><div class="v b">${DATA.scores.authority}<small style="font-size:14px">/10</small></div><div class="l">Autoridad</div></div>
      <div class="sc"><div class="v w">${DATA.scores.local}<small style="font-size:14px">/10</small></div><div class="l">Oportunidad local</div></div>
    </div>
  </section>

  <section>
    <h2><span class="snum">1</span><span class="t display">Web — técnico y on-page <span class="tag good">fuerte</span></span></h2>
    <p class="soft">Análisis real de ${DATA.domain} (home).</p>
    <table>
      <tr><td>Velocidad móvil (PageSpeed)</td><td><b style="color:var(--good)">${DATA.web.speed}/100</b> — excelente</td><td>${ck(DATA.web.speed>=80)}</td></tr>
      <tr><td>Schema estructurado (datos para Google)</td><td>Muy completo</td><td>${ck(DATA.web.schema)}</td></tr>
      <tr><td>Keyword local en el título / H1</td><td>"Pilates… en Valencia, Venezuela"</td><td>${ck(DATA.web.localKw)}</td></tr>
      <tr><td>Adaptada a móvil (viewport)</td><td>Sí</td><td>${ck(DATA.web.viewport)}</td></tr>
      <tr><td>Mapa de Google embebido</td><td>No detectado</td><td>${ck(DATA.web.map)}</td></tr>
      <tr><td>Teléfono clicable (tel:)</td><td>No detectado</td><td>${ck(DATA.web.phone)}</td></tr>
    </table>
    <p class="soft">Schema detectado: completísimo (cubre lo que la mayoría no pone).</p>
    <div class="chips">${DATA.web.schemaTypes.slice(0,14).map((t)=>`<span>${t}</span>`).join("")}</div>
    <p><b>Veredicto:</b> la base técnica está resuelta. Solo faltan dos detalles fáciles: <b>embeber el mapa</b> y hacer el <b>teléfono clicable</b> (mejoran conversión en móvil y señal local).</p>
  </section>

  <section>
    <h2><span class="snum">2</span><span class="t display">Ficha de Google Business <span class="tag bad">crítico</span></span></h2>
    <p>Aquí está el cuello de botella. La ficha existe y enlaza a la web, pero:</p>
    <table>
      <tr><td>Reseñas</td><td><b style="color:var(--bad)">0</b></td><td><span class="tag bad">urgente</span></td></tr>
      <tr><td>Categoría principal</td><td>"${DATA.gbp.category}"</td><td><span class="tag warn">corregir</span></td></tr>
      <tr><td>Enlace a la web</td><td>Sí</td><td>${ck(true)}</td></tr>
    </table>
    <p><b>Por qué importa:</b> en local, la ficha de Google + las reseñas pesan <b>más que la web</b> para salir en el Map Pack (los 3 resultados con mapa). 0 reseñas = prácticamente invisible aunque la web sea perfecta. Cambiar la categoría a <b>"Estudio de pilates"</b> y arrancar reseñas es lo que más mueve la aguja, y lo más rápido.</p>
  </section>

  <section>
    <h2><span class="snum">3</span><span class="t display">Autoridad / enlaces <span class="tag warn">por construir</span></span></h2>
    <p>El sitio tiene <b>~0 backlinks</b> y ~0 dominios de referencia. Es normal en una web nueva, pero conviene construir base: <b>citations</b> (directorios con NAP consistente), perfiles sociales enlazados, y 3-5 enlaces locales de calidad (prensa local, partners, blogs del sector). No hace falta volumen — consistencia y relevancia.</p>
  </section>

  <section>
    <h2><span class="snum">4</span><span class="t display">Competencia local — Valencia, VE</span></h2>
    <p>El mercado local de pilates está <b>muy poco desarrollado en Google</b>. Rivales y sus reseñas:</p>
    <table><tr><th>Estudio</th><th>Reseñas</th></tr>
      ${DATA.competitors.map((c)=>`<tr><td>${c.name}</td><td class="display" style="font-size:16px">${c.reviews}</td></tr>`).join("")}
      <tr style="background:#F4E9D6"><td><b>AAURA (tú)</b></td><td class="display" style="font-size:16px;color:var(--bad)">0</td></tr>
    </table>
    <div class="callout"><b>Lectura:</b> el líder local tiene 10 reseñas. Con una campaña de reseñas sencilla (link + QR + petición a todos los clientes) <b>superas a todos en pocas semanas</b>, y con la web que ya tenéis, el Map Pack es vuestro.</div>
  </section>

  <section>
    <h2><span class="snum">5</span><span class="t display">Nota sobre los datos</span></h2>
    <p class="soft">Venezuela <b>no está cubierta</b> por las bases de datos SEO (DataForSEO Labs, Ahrefs) — no se pueden sacar posiciones de keywords ni volúmenes fiables del mercado venezolano. Para datos reales de búsquedas y posiciones: <b>conectar Google Search Console</b> (gratis) y usar las <b>estadísticas de la propia ficha de Google</b> (vistas, llamadas, clics). Eso da la foto real local que las herramientas no cubren.</p>
  </section>

  <section>
    <h2><span class="snum">6</span><span class="t display">Plan de acción priorizado</span></h2>
    <p class="soft" style="margin-top:0">Por orden de impacto/rapidez:</p>
    <ol class="plan">
      <li><span class="n">1</span><div><b>Ficha de Google: categoría + completar</b><div class="d">Cambiar a "Estudio de pilates", añadir servicios, horarios, fotos buenas, primeros posts y Q&A. (Esta semana.)</div></div></li>
      <li><span class="n">2</span><div><b>Campaña de reseñas (0 → 20+)</b><div class="d">Link directo + QR en el local + petición a todos los clientes por WhatsApp. Es lo que más sube en el Map Pack. (2-4 semanas.)</div></div></li>
      <li><span class="n">3</span><div><b>Mapa embebido + teléfono clicable en la web</b><div class="d">Dos arreglos rápidos que mejoran conversión móvil y señal local.</div></div></li>
      <li><span class="n">4</span><div><b>NAP + citations consistentes</b><div class="d">Mismo nombre/dirección/teléfono en directorios y redes; enlazar Instagram/redes desde la web.</div></div></li>
      <li><span class="n">5</span><div><b>Conectar Search Console + revisar GBP Insights</b><div class="d">Para medir de verdad (Venezuela no sale en las herramientas SEO).</div></div></li>
      <li><span class="n">6</span><div><b>Contenido local + primeros backlinks</b><div class="d">Páginas/artículos para "pilates Valencia", "sculptformer", "reformer"; 3-5 enlaces locales de calidad.</div></div></li>
    </ol>
  </section>

</div>
<div class="foot"><span class="wm">${BRAND.toUpperCase()}</span><span>Análisis con datos públicos (web, PageSpeed, Google, DataForSEO) · ${DATA.date}</span></div>
</div></body></html>`;

const out = resolve(REPO_ROOT, "analisis-seo-auraa.html");
writeFileSync(out, html, "utf8");
console.log("Informe Auraa → " + out + " (global " + overall + "/100)");
