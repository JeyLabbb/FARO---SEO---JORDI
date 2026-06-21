#!/usr/bin/env node
// dashboard.mjs — genera un panel HTML autocontenido (doble clic, sin servidor)
// con: KPIs, estado del sistema, cómo funciona, roadmap y el pipeline de outreach.
// Lee los datos reales de audits/_run-summary-*.json y las credenciales de .env.
// Uso: npm run dashboard  →  abre dashboard.html (en la raíz del repo).
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, REPO_ROOT, BRAND } from "./config.mjs";
import { today, normalize } from "./lib/slug.mjs";

const dir = resolve(ROOT, "audits");

// ── Credenciales presentes ──
const creds = {
  google: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  dataforseo: Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
  brevo: Boolean(process.env.BREVO_API_KEY),
  apify: Boolean(process.env.APIFY_TOKEN),
};

// ── Negocios (de los run-summaries) ──
const statusFile = resolve(dir, "status.json");
const statusMap = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, "utf8")) : {};
const seen = new Set();
const biz = [];
for (const f of readdirSync(dir).filter((f) => /^_run-summary-.*\.json$/.test(f))) {
  for (const s of JSON.parse(readFileSync(resolve(dir, f), "utf8"))) {
    if (s.error) continue;
    const k = normalize(s.name);
    if (seen.has(k)) continue;
    seen.add(k);
    biz.push({ ...s, status: statusMap[s.name] || "pendiente" });
  }
}
const count = (st) => biz.filter((b) => b.status === st).length;
const kpis = {
  audits: biz.length,
  phone: biz.filter((b) => b.phone).length,
  email: biz.filter((b) => b.email).length,
  enviado: count("enviado"),
  respondio: count("respondió"),
  cerrado: count("cerrado"),
};

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const cell = (s) => esc(String(s ?? "").replace(/\|/g, " "));

// ── Estado del sistema ──
const D = "✅"; const W = "🔧"; const P = "⏳";
const pieces = [
  ["Generador de auditorías", D, "Datos reales de Google → audit de 1 página"],
  ["Buscador de objetivos", D, "170 negocios en banco (Pamplona + Tudela)"],
  ["Pipeline de 1 comando (run)", D, "resuelve → audita → PDF → contacto → mensajes → tracker"],
  ["PDFs premium", D, "listos para enviar"],
  ["Mensajes WhatsApp (valor primero)", D, "link que abre WhatsApp con el mensaje escrito"],
  ["Buscador de emails", D, "saca emails de la web (acierta ~⅓)"],
  ["Dashboard", D, "este panel"],
  ["Posición REAL + teléfonos (DataForSEO)", creds.dataforseo ? D : W, creds.dataforseo ? "activo" : "falta DATAFORSEO_LOGIN/PASSWORD (Jorge)"],
  ["Envío de email automático (Brevo)", creds.brevo ? D : W, creds.brevo ? "activo" : "falta BREVO_API_KEY (agent_config)"],
  ["Más emails (Apify)", creds.apify ? D : W, creds.apify ? "activo" : "falta APIFY_TOKEN (agent_config)"],
  ["Escalado email (Smartlead + dominios)", P, "decisión de compra (~100$) + warm-up 2-4 sem"],
  ["CRM en vivo (Supabase)", P, "tracker → tabla outreach_campaigns"],
  ["Landing del servicio (P2)", P, "pendiente"],
  ["Sistema de reseñas (P3)", P, "WhatsApp post-venta (BRAIN listo)"],
  ["Entrega automatizada (P4)", P, "agentes: posts / reseñas / reporte mensual"],
];

const flow = [
  ["1 · Descubrir", "discover", "Lista negocios de una zona con sus huecos"],
  ["2 · Auditar", "run", "Audit + PDF con datos reales de Google"],
  ["3 · Contactar", "WhatsApp / email", "Valor primero: les mandas el análisis"],
  ["4 · Cerrar", "guion-venta", "Llamada/visita → setup + mensualidad"],
  ["5 · Entregar", "agentes (P4)", "Optimizar ficha, reseñas, posts, reporte"],
];

const stBadge = (st) => `<span class="badge ${normalize(st).replace(/[^a-z]/g, "")}">${esc(st)}</span>`;

const pipelineRows = biz
  .map((b, i) => {
    const chan = [];
    if (b.waLink) chan.push(`<a href="${esc(b.waLink)}">WhatsApp</a>`);
    if (b.email) chan.push(`✉️`);
    return `<tr><td>${i + 1}</td><td>${cell(b.name)}</td><td>${cell(b.searchHint)}</td>
      <td class="num">${b.reviews ?? "—"}</td><td class="num">${b.avgPos != null ? "≈" + b.avgPos : "—"}</td>
      <td>${b.hasWeb ? "sí" : '<b class="bad">no</b>'}</td><td>${chan.join(" ") || "—"}</td><td>${stBadge(b.status)}</td></tr>`;
  })
  .join("");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${BRAND} · Panel de control</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--paper:#FBF8F1;--shell:#ECE7DB;--card:#fff;--ink:#1B1C18;--soft:#5C594F;--faint:#8C887B;--line:#E7E1D3;--pine:#1E3A31;--pine2:#2C5247;--ochre:#C0772A;--ochreb:#F4E9D6;--good:#2E7D52;--warn:#C0772A;--bad:#BC4630;--pend:#9A9486;}
*{box-sizing:border-box}body{margin:0;background:var(--shell);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:14px;line-height:1.5}
.wrap{max-width:1040px;margin:24px auto;padding:0 20px}
.head{background:var(--pine);color:#F3EFE4;border-radius:12px;padding:24px 28px;position:relative;overflow:hidden}
.head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--ochre)}
.wm{font-weight:700;letter-spacing:.28em;font-size:13px}.wm b{color:var(--ochre)}
.head h1{font-family:"Fraunces",serif;font-weight:600;font-size:30px;margin:10px 0 2px;color:#FCFAF4}
.head .sub{color:#B7CCC1;font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:18px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.kpi .v{font-family:"Fraunces",serif;font-size:30px;font-weight:600;line-height:1}
.kpi .l{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:600;margin-top:6px}
.kpi.hot .v{color:var(--ochre)}.kpi.good .v{color:var(--good)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:16px 0}
h2{font-family:"Fraunces",serif;font-size:19px;font-weight:600;margin:0 0 14px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:7px 9px;text-align:left;border-bottom:1px solid var(--line)}
th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--soft);font-weight:600}
td.num{font-family:"Fraunces",serif} .bad{color:var(--bad)} a{color:var(--pine2);font-weight:600}
.st{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.st .i{flex:0 0 auto}.st .n{flex:1}.st .d{color:var(--faint);font-size:12px}
.flow{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.step{background:var(--ochreb);border-radius:10px;padding:12px}.step .t{font-weight:700;font-family:"Fraunces",serif}.step .c{font-size:12px;color:#5a4423}.step .d{font-size:11.5px;color:#6b5836;margin-top:3px}
.badge{font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;color:#fff}
.badge.pendiente{background:var(--pend)}.badge.enviado{background:var(--pine2)}.badge.respondio{background:var(--ochre)}.badge.cerrado{background:var(--good)}
.roadmap{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.et{border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--paper)}.et h3{margin:0 0 6px;font-size:13px}.et.cur{border-color:var(--ochre);background:var(--ochreb)}
.foot{color:var(--faint);font-size:11px;text-align:center;margin:18px 0}
@media(max-width:760px){.kpis{grid-template-columns:repeat(3,1fr)}.grid2,.flow,.roadmap{grid-template-columns:1fr}}
</style></head><body><div class="wrap">

<div class="head"><span class="wm">${BRAND}</span><h1>Panel de control — SEO local</h1>
<div class="sub">Generado ${today()} · datos reales de tus audits · doble clic para abrir (regenera con <code>npm run dashboard</code>)</div></div>

<div class="kpis">
<div class="kpi hot"><div class="v">${kpis.audits}</div><div class="l">Audits listos</div></div>
<div class="kpi"><div class="v">${kpis.phone}</div><div class="l">Con teléfono</div></div>
<div class="kpi"><div class="v">${kpis.email}</div><div class="l">Con email</div></div>
<div class="kpi"><div class="v">${kpis.enviado}</div><div class="l">Contactados</div></div>
<div class="kpi"><div class="v">${kpis.respondio}</div><div class="l">Respondieron</div></div>
<div class="kpi good"><div class="v">${kpis.cerrado}</div><div class="l">Cerrados</div></div>
</div>

<div class="card"><h2>Cómo funciona</h2><div class="flow">
${flow.map((s) => `<div class="step"><div class="t">${esc(s[0])}</div><div class="c">${esc(s[1])}</div><div class="d">${esc(s[2])}</div></div>`).join("")}
</div></div>

<div class="grid2">
<div class="card"><h2>Estado del sistema</h2>
${pieces.map((p) => `<div class="st"><span class="i">${p[1]}</span><span class="n">${esc(p[0])}</span><span class="d">${esc(p[2])}</span></div>`).join("")}
<p style="font-size:11.5px;color:var(--faint);margin:12px 0 0">✅ hecho · 🔧 listo, falta credencial · ⏳ pendiente</p>
</div>
<div class="card"><h2>Roadmap</h2><div class="roadmap">
<div class="et cur"><h3>Etapa 0 — Hoy ✅</h3><div class="d" style="font-size:12px;color:var(--soft)">Audits + PDFs + WhatsApp manual. <b>A enviar ya.</b></div></div>
<div class="et"><h3>Etapa 1 — Validar</h3><div class="d" style="font-size:12px;color:var(--soft)">+ DataForSEO + Brevo (≤50/día). Medir % respuesta.</div></div>
<div class="et"><h3>Etapa 2 — Escalar</h3><div class="d" style="font-size:12px;color:var(--soft)">Smartlead + dominios + warm-up → 500-1000/día.</div></div>
<div class="et"><h3>Etapa 3 — Entregar</h3><div class="d" style="font-size:12px;color:var(--soft)">Agentes: posts, reseñas, reporte. Y dashboard cliente.</div></div>
</div>
<p style="font-size:12px;color:var(--soft);margin-top:14px"><b>Falta para escalar:</b> credenciales DataForSEO, Brevo, Apify (→ CREDENCIALES.md) + decisión Smartlead.</p>
</div>
</div>

<div class="card"><h2>Pipeline de outreach (${biz.length})</h2>
<table><thead><tr><th>#</th><th>Negocio</th><th>Búsqueda</th><th>Reseñas</th><th>Pos</th><th>Web</th><th>Canal</th><th>Estado</th></tr></thead>
<tbody>${pipelineRows}</tbody></table>
<p style="font-size:11.5px;color:var(--faint);margin:10px 0 0">Para marcar progreso: edita <code>audits/status.json</code> ({"Negocio":"enviado"}) y vuelve a generar. La versión en vivo (Supabase) es la Etapa 3.</p>
</div>

<div class="foot">${BRAND} · panel interno · datos públicos (Google Places + PageSpeed)</div>
</div></body></html>`;

const out = resolve(REPO_ROOT, "dashboard.html");
writeFileSync(out, html, "utf8");
console.log(`Dashboard → ${out}  (${biz.length} negocios, audits:${kpis.audits} tel:${kpis.phone} email:${kpis.email})`);
