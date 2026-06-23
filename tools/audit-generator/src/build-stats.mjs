// build-stats.mjs — PANEL DE OPERACIONES de Faro. Junta TODO el estado del sistema
// (almacén, cuentas+ramp, envíos, seguimientos, variantes, leads, último run) y
// genera un dashboard HTML autocontenido que se regenera en cada ejecución.
//   node src/build-stats.mjs   → panel-interno.html (raíz del repo)
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { VARIANTS } from "./lib/email-copy.mjs";
import { variantWeights } from "./lib/variant-policy.mjs";
import { accountReport, capacity } from "./lib/caps.mjs";

const T = (p) => resolve(REPO_ROOT, "targets", p);
const J = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const latest = (re) => { try { const f = readdirSync(resolve(REPO_ROOT, "targets")).filter((n) => re.test(n)).sort(); return f.length ? f[f.length - 1] : null; } catch { return null; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (n, d) => (d ? (n / d * 100) : 0);
const pc1 = (n, d) => pct(n, d).toFixed(1) + "%";

// ── datos ──
const sent = J(T("sent-log.json"), {});
const fl = J(T("followup-log.json"), {});
const cola = J(T("cola.json"), { items: {}, descartados: {} });
const leadsFile = latest(/^leads-.*\.json$/);
const leads = leadsFile ? J(T(leadsFile), []) : [];
const inboxFile = latest(/^inbox-state-.*\.json$/);
const inbox = inboxFile ? J(T(inboxFile), { bouncedEmails: [] }) : { bouncedEmails: [] };
const lastRun = J(T("last-run.json"), null);
const frenoOn = existsSync(T("PARAR.flag"));

const bounced = new Set((inbox.bouncedEmails || []).map((e) => String(e).toLowerCase()));

// ── agregados ──
const sentArr = Object.entries(sent).map(([pid, v]) => ({ pid, ...v }));
const contactados = sentArr.length;
let rebotes = 0; const byDay = {}; const sentByAcc = {};
for (const v of sentArr) {
  if (v.to && bounced.has(String(v.to).toLowerCase())) rebotes++;
  const d = (v.at || "").slice(0, 10); if (d) (byDay[d] = byDay[d] || { ini: 0, fu: 0 }).ini++;
  sentByAcc[v.account || "?"] = (sentByAcc[v.account || "?"] || 0) + 1;
}
for (const v of Object.values(fl)) { const d = (v.at || "").slice(0, 10); if (d) (byDay[d] = byDay[d] || { ini: 0, fu: 0 }).fu++; }
const entregados = contactados - rebotes;
const respuestas = leads.length;
const POSITIVE = new Set(["interesado", "pregunta"]);
const interesados = leads.filter((l) => l.estado === "interesado").length;
const bajas = leads.filter((l) => l.estado === "baja").length;
const enviadosHoy = sentArr.filter((v) => (v.at || "").slice(0, 10) === today()).length;

// almacén
const items = Object.values(cola.items || {});
const listos = items.filter((i) => i.status === "listo");
const conPDF = listos.filter((i) => existsSync(resolve(REPO_ROOT, "apps", "web", "audits", `${i.slug}.pdf`))).length;
const deployable = listos.filter((i) => i.email && !sent[i.place_id] && existsSync(resolve(REPO_ROOT, "apps", "web", "audits", `${i.slug}.pdf`))).length;
const descartados = cola.descartados || {};
const descTotal = Object.keys(descartados).length;
const descCat = { "sin email": 0, "sin competidor": 0, "categoría vetada": 0, "otros": 0 };
for (const r of Object.values(descartados)) {
  const s = String(r).toLowerCase();
  if (s.includes("email")) descCat["sin email"]++;
  else if (s.includes("competidor")) descCat["sin competidor"]++;
  else if (s.includes("vetada")) descCat["categoría vetada"]++;
  else descCat["otros"]++;
}

// cuentas + capacidad
const caps = accountReport(sent, bounced);
const capDia = capacity(sent, bounced);
const nuevosDia = Math.max(1, Math.round(capDia * 0.6));
const bufferDias = nuevosDia ? Math.round(conPDF / nuevosDia) : 0;
// Alerta de cuentas con problema (ralentizada/congelada/pausada): se ve en el panel y en el parte diario (last-run).
const problemAcc = caps.filter((a) => a.state && a.state !== "ok");
const alerta = problemAcc.length ? "⚠️ " + problemAcc.map((a) => `${a.account} ${a.state === "spam" ? "EN SPAM (parada)" : a.state === "paused" ? "PAUSADA" : a.state === "frozen" ? "CONGELADA" : "ralentizada " + a.cap + "/día"}`).join(" · ") : "";

// etapas
const seg1 = Object.values(fl).filter((v) => (v.n || 0) >= 1).length;
const seg2 = Object.values(fl).filter((v) => (v.n || 0) >= 2).length;

// variantes
const vw = variantWeights(sent, leads);

// ── HTML ──
const days = Object.keys(byDay).sort();
const maxDay = Math.max(1, ...days.map((d) => byDay[d].ini + byDay[d].fu));
const estadoColor = { interesado: "#1C8A5B", pregunta: "#1C8A5B", no_interesado: "#C9780A", baja: "#8A8790", fuera_oficina: "#8A8790", automatico: "#8A8790" };

const kpi = (n, label, sub, cls = "") => `<div class="kpi"><div class="kn ${cls}">${n}</div><div class="kl">${label}</div><div class="ks">${sub}</div></div>`;

const accRows = caps.map((a) => `<tr>
  <td class="b">${esc(a.account)}</td>
  <td class="num">${a.sends}</td>
  <td class="num">${a.days}d</td>
  <td class="num" style="color:${a.bounceRate > 10 ? "var(--red)" : a.bounceRate > 5 ? "var(--amber)" : "var(--green)"}">${a.bounceRate}%</td>
  <td class="num">${a.state === "spam" ? '<span class="pill red">🚫 en spam (parada)</span>' : a.state === "paused" ? '<span class="pill grey">⏸ pausada a mano</span>' : a.state === "frozen" ? '<span class="pill red">❄ congelada</span>' : a.state === "throttled" ? '<span class="pill amber">🐢 ralentizada · ' + a.cap + '/día</span>' : '<span class="pill green">' + a.cap + '/día</span>'}</td>
</tr>`).join("");

const dayRows = days.slice(-21).map((d) => { const o = byDay[d]; const tot = o.ini + o.fu; return `<div class="bar"><span class="bl">${d.slice(5)}</span><span class="bt"><span class="bf ini" style="width:${o.ini / maxDay * 100}%"></span><span class="bf fu" style="width:${o.fu / maxDay * 100}%"></span></span><span class="bn">${tot}<span class="bsub"> · ${o.ini}n/${o.fu}s</span></span></div>`; }).join("") || '<div class="empty">Aún no hay envíos.</div>';

const varRows = [...new Set([...VARIANTS.map((v) => v.id), ...Object.keys(vw.sends)])].map((id) => {
  const nombre = (VARIANTS.find((v) => v.id === id) || {}).nombre || "";
  const s = vw.sends[id] || 0, rp = vw.replies[id] || 0, it = vw.positives[id] || 0, w = vw.weights[id] || 0;
  return `<tr><td class="b">${id} · ${esc(nombre)}</td><td class="num">${s}</td><td class="num">${rp}</td><td class="num">${pc1(rp, s)}</td><td class="num">${it}</td><td class="num">${Math.round(w * 100)}%</td></tr>`;
}).join("");

const descBars = Object.entries(descCat).filter(([, n]) => n > 0).map(([k, n]) => `<div class="bar"><span class="bl wide">${k}</span><span class="bt"><span class="bf grey" style="width:${n / Math.max(1, descTotal) * 100}%"></span></span><span class="bn">${n}</span></div>`).join("") || '<div class="empty">—</div>';

const leadRows = leads.map((l, i) => `<tr data-s="${esc((l.negocio || "") + " " + (l.email || "") + " " + (l.estado || ""))}">
  <td class="b">${esc(l.negocio || l.email || "?")}<div class="sub">${esc(l.email || "")}</div></td>
  <td><span class="badge" style="background:${estadoColor[l.estado] || "#8A8790"}">${esc(l.estado || "?")}</span></td>
  <td>${esc(l.resumen || "")}</td>
  <td class="acc">${esc(l.accion || "")}</td>
</tr>`).join("");

const runSteps = lastRun && lastRun.pasos ? Object.entries(lastRun.pasos).map(([k, v]) => `<span class="step ${String(v).startsWith("ok") ? "ok" : "err"}">${esc(k)}</span>`).join(" ") : "<i>sin datos de ejecución todavía</i>";

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Faro · Panel de operaciones</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#16151A;--mut:#6A6770;--faint:#9A97A1;--line:#E9E7EC;--red:#DC2330;--amber:#C9780A;--green:#1C8A5B;--bg:#F3F4F6;--card:#fff;--pine:#155E47}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:15px;line-height:1.5}
.top{position:sticky;top:0;z-index:9;background:rgba(243,244,246,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 26px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.brand{font-weight:800;letter-spacing:.02em;font-size:18px}.brand b{color:var(--pine)}
.top .when{color:var(--faint);font-size:12.5px}
.freno{margin-left:auto;font-weight:700;font-size:12.5px;padding:6px 14px;border-radius:20px}
.freno.on{background:#FBE6E8;color:var(--red)}.freno.off{background:#E6F4EC;color:var(--green)}
nav{display:flex;gap:8px;flex-wrap:wrap;padding:14px 26px 0}
nav a{font-size:13px;font-weight:600;color:var(--mut);text-decoration:none;padding:6px 12px;border:1px solid var(--line);border-radius:20px;background:#fff}
nav a:hover{color:var(--ink);border-color:var(--ink)}
.wrap{max-width:1080px;margin:0 auto;padding:8px 26px 80px}
h2{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);font-weight:700;margin:34px 0 14px}
section{scroll-margin-top:120px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
@media(max-width:880px){.kpis{grid-template-columns:repeat(2,1fr)}.cards3{grid-template-columns:1fr 1fr!important}}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 18px}
.kn{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1}.kn.green{color:var(--green)}.kn.red{color:var(--red)}.kn.pine{color:var(--pine)}
.kl{font-weight:600;margin-top:8px;font-size:14px}.ks{color:var(--faint);font-size:12px;margin-top:2px}
.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px}
.grid2{display:grid;grid-template-columns:1.3fr 1fr;gap:20px}@media(max-width:880px){.grid2{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}
th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);text-align:left;padding:11px 14px;border-bottom:1px solid var(--line)}
td{padding:12px 14px;border-bottom:1px solid var(--line)}tr:last-child td{border-bottom:none}
td.num,th.num{text-align:right}td.b{font-weight:600}.sub{color:var(--faint);font-size:12px;font-weight:400}.acc{color:var(--mut);font-size:13px}
.pill{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:20px}.pill.green{background:#E6F4EC;color:var(--green)}.pill.red{background:#FBE6E8;color:var(--red)}.pill.amber{background:#FBF0DD;color:var(--amber)}.pill.grey{background:#ECEBEF;color:var(--mut)}
.badge{color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:capitalize}
.bar{display:grid;grid-template-columns:64px 1fr 96px;align-items:center;gap:10px;padding:5px 0}
.bar .wide{grid-column:auto}.bl{font-size:12.5px;color:var(--mut)}.bl.wide{width:auto}
.bt{height:16px;background:#ECEBEF;border-radius:5px;overflow:hidden;display:flex}
.bf{display:block;height:100%}.bf.ini{background:var(--pine)}.bf.fu{background:#9DC8B8}.bf.grey{background:var(--faint);border-radius:5px}
.bn{font-size:12.5px;font-weight:700;text-align:right}.bsub{color:var(--faint);font-weight:400;font-size:11px}
.note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--pine);border-radius:10px;padding:13px 16px;color:var(--mut);font-size:13px;margin-top:12px}
.legend{font-size:12px;color:var(--faint);margin-top:8px}.legend b{font-weight:700}
.sbox{width:100%;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:14px;margin-bottom:10px}
.steps{display:flex;gap:6px;flex-wrap:wrap}.step{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:8px}.step.ok{background:#E6F4EC;color:var(--green)}.step.err{background:#FBE6E8;color:var(--red)}
.empty{color:var(--faint);font-size:13px;padding:8px 0}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--faint);font-size:12.5px}
</style></head><body>
<div class="top"><span class="brand"><b>Faro</b> · Operaciones</span><span class="when">actualizado ${esc(lastRun?.at?.slice(0, 16).replace("T", " ") || today())}</span>
<span class="freno ${frenoOn ? "on" : "off"}">${frenoOn ? "⛔ FRENO PUESTO · no envía" : "● ENVIANDO"}</span></div>
<nav><a href="#resumen">Resumen</a><a href="#almacen">Almacén</a><a href="#cuentas">Cuentas</a><a href="#envios">Envíos</a><a href="#variantes">Variantes</a><a href="#leads">Leads</a></nav>
<div class="wrap">

<section id="resumen"><h2>Embudo</h2>
<div class="kpis">
${kpi(conPDF, "Munición lista", `${listos.length} en almacén · ${bufferDias} días`, "pine")}
${kpi(contactados, "Contactados", `${descTotal} descartados por calidad`)}
${kpi(entregados, "Entregados", `${pc1(entregados, contactados)} · ${rebotes} rebotes`)}
${kpi(respuestas, "Respuestas", pc1(respuestas, contactados) + " de contactados")}
${kpi(interesados, "Interesados", `${bajas} bajas · los cierra Jordi`, "green")}
</div>
<div class="note">Capacidad actual: <b>${capDia} envíos/día</b> con ${caps.length} cuentas (~${nuevosDia} nuevos + seguimientos). Métrica de éxito = <b>respuestas</b>, no aperturas.</div>
</section>

<section id="almacen"><h2>Almacén (munición)</h2>
<div class="grid2">
  <div class="cards3">
    ${kpi(listos.length, "Listos", "informes en cola", "pine")}
    ${kpi(conPDF, "Con PDF", `${listos.length - conPDF} sin PDF`)}
    ${kpi(bufferDias + "d", "Colchón", "a ritmo actual")}
  </div>
  <div class="card"><div class="kl" style="margin:0 0 8px">Descartados por calidad (${descTotal})</div>${descBars}</div>
</div>
<div class="note">El almacén se rellena solo (audit cold gratis + gancho IA + QA). Lo que no pasa el filtro (sin email, sin competidor para comparar, categoría que no encaja) se descarta y no se vuelve a tocar.</div>
</section>

<section id="cuentas"><h2>Cuentas (salud y ramp-up)</h2>
<table><thead><tr><th>Cuenta</th><th class="num">Enviados</th><th class="num">Antig.</th><th class="num">% rebote</th><th class="num">Tope hoy</th></tr></thead><tbody>${accRows}</tbody></table>
${alerta ? `<div class="note" style="border-left-color:var(--amber);color:var(--amber);font-weight:600">${esc(alerta)}</div>` : ""}
<div class="note">El tope sube con la antigüedad de cada cuenta. Si una pasa del <b>5% de rebotes</b> se <b>ralentiza</b>, del <b>10%</b> se <b>para sola</b>, y si el monitor la detecta <b>en spam</b> también se para. Para parar una a mano: añade su email a <b>targets/cuentas-pausadas.json</b>. Mete más cuentas calentadas → la capacidad sube sola.</div>
</section>

<section id="envios"><h2>Envíos por día (últimos 21)</h2>
<div class="grid2">
  <div class="card">${dayRows}<div class="legend"><b style="color:var(--pine)">■</b> nuevos · <b style="color:#9DC8B8">■</b> seguimientos</div></div>
  <div class="cards3" style="grid-template-columns:1fr">
    ${kpi(contactados, "Email inicial", "")}
    ${kpi(seg1, "Seguimiento 1", "")}
    ${kpi(seg2, "Seguimiento 2", "")}
  </div>
</div>
</section>

<section id="variantes"><h2>Variantes de email (experimento A/B)</h2>
<table><thead><tr><th>Variante</th><th class="num">Enviados</th><th class="num">Respuestas</th><th class="num">% resp.</th><th class="num">Interes.</th><th class="num">Reparto</th></tr></thead><tbody>${varRows}</tbody></table>
<div class="note">Reparto actual: <b>${vw.decided ? "ponderado" : "igual"}</b> ${vw.decided ? "(ya hay muestra → más volumen a la que más convierte)" : "— muestra insuficiente, no se decide nada todavía (sería suerte)"}. Umbral para decidir: 120 envíos/variante y 8 respuestas (llevamos ${vw.totalReplies}).</div>
</section>

<section id="leads"><h2>Leads y respuestas (clasificadas por IA)</h2>
<input class="sbox" id="q" placeholder="Buscar negocio / email / estado…" oninput="for(const r of document.querySelectorAll('#lt tbody tr')){r.style.display=r.dataset.s.toLowerCase().includes(this.value.toLowerCase())?'':'none'}">
<table id="lt"><thead><tr><th>Negocio</th><th>Estado</th><th>Resumen</th><th>Qué haría Jordi</th></tr></thead><tbody>${leadRows || `<tr><td colspan="4" class="empty">Sin respuestas todavía.</td></tr>`}</tbody></table>
<div class="note">Los <b>interesados</b> los cierras tú (salen del seguimiento automático). Las <b>bajas</b> se descartan. El resto sigue su secuencia de seguimientos.</div>
</section>

<div class="foot">Última ejecución del sistema: ${lastRun ? esc(lastRun.at?.slice(0, 16).replace("T", " ")) + ` · elegidos ${lastRun.elegidos ?? "—"} · PDFs ${lastRun.pdfsListos ?? "—"} · cuentas ${lastRun.cuentas ?? "—"}` : "—"}<div class="steps" style="margin-top:8px">${runSteps}</div></div>
</div></body></html>`;

const out = resolve(REPO_ROOT, "panel-interno.html");
writeFileSync(out, html, "utf8");

// Versión DESPLEGABLE protegida: una función serverless que pide contraseña (Basic Auth)
// antes de servir el panel → los emails de leads NO quedan en un estático público. Gratis.
const fnDir = resolve(REPO_ROOT, "apps", "panel-ops", "api");
mkdirSync(fnDir, { recursive: true });
const fn = "const HTML = " + JSON.stringify(html) + ";\n"
  + "module.exports = (req, res) => {\n"
  + "  const pass = process.env.PANEL_PASS || 'faro2026';\n"
  + "  const a = req.headers.authorization || '';\n"
  + "  const dec = a.indexOf('Basic ') === 0 ? Buffer.from(a.slice(6), 'base64').toString() : '';\n"
  + "  const pw = dec.indexOf(':') >= 0 ? dec.slice(dec.indexOf(':') + 1) : '';\n"
  + "  if (pw !== pass) { res.setHeader('WWW-Authenticate', 'Basic'); res.statusCode = 401; res.end('Auth requerida'); return; }\n"
  + "  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.statusCode = 200; res.end(HTML);\n"
  + "};\n";
writeFileSync(resolve(fnDir, "index.js"), fn, "utf8");
writeFileSync(resolve(REPO_ROOT, "apps", "panel-ops", "vercel.json"), JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/api/index" }] }, null, 2), "utf8");

// Estado resumido para el parte diario por email (daily-report.mjs): JSON pequeño y estable.
writeFileSync(T("stats.json"), JSON.stringify({
  at: new Date().toISOString(),
  contactados, entregados, rebotes, rebotePct: pc1(rebotes, contactados),
  respuestas, interesados, bajas, enviadosHoy,
  listos: listos.length, stockDesplegable: deployable, bufferDias: Math.round(deployable / Math.max(1, Math.round(capDia * 0.9))), capDia,
  cuentas: caps.map((a) => ({ account: a.account, state: a.state, cap: a.cap, bounceRate: a.bounceRate, sends: a.sends })),
  cuentasTocadas: problemAcc.map((a) => ({ account: a.account, state: a.state, bounceRate: a.bounceRate, cap: a.cap })),
  alerta,
}, null, 2), "utf8");

console.log(`Panel → ${out}  ·  función protegida → apps/panel-ops/`);
console.log(`Contactados ${contactados} · Entregados ${entregados} · Respuestas ${respuestas} · Interesados ${interesados} · Almacén ${listos.length} (${conPDF} con PDF) · Capacidad ${capDia}/día · Freno ${frenoOn ? "ON" : "off"}${alerta ? " · " + alerta : ""}`);
