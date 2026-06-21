// build-stats.mjs — PANEL INTERNO de outreach. Junta sent-log + followup-log +
// inbox-state + leads y genera un HTML claro: embudo, salud por cuenta, envíos por
// día, por etapa, variantes (experimento) y la lista de leads clasificados.
//   node src/build-stats.mjs   → panel-interno.html (raíz del repo)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { VARIANTS } from "./lib/email-copy.mjs";
import { variantWeights } from "./lib/variant-policy.mjs";
import { accountReport, capacity } from "./lib/caps.mjs";

const T = (p) => resolve(REPO_ROOT, "targets", p);
const J = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };

const sent = J(T("sent-log.json"), {});
const fl = J(T("followup-log.json"), {});
const state = J(T(`inbox-state-${today()}.json`), { bouncedEmails: [], replies: [] });
// leads más reciente
const leadFiles = readdirSync(resolve(REPO_ROOT, "targets")).filter((n) => /^leads-.*\.json$/.test(n)).sort();
const leads = leadFiles.length ? J(T(leadFiles[leadFiles.length - 1]), []) : [];

const bounced = new Set((state.bouncedEmails || []).map((e) => e.toLowerCase()));
// Almacén (cola) + capacidad de envío para la monitorización.
const cola = (() => { try { return JSON.parse(readFileSync(T("cola.json"), "utf8")); } catch { return { items: {}, descartados: {} }; } })();
const colaListos = Object.values(cola.items || {}).filter((i) => i.status === "listo").length;
const colaDesc = Object.keys(cola.descartados || {}).length;
const capDia = capacity(sent, bounced);

// ── agregados ──
const sentByAcc = {}, bounceByAcc = {}, byDay = {}, sentByVariant = {}, emailToVariant = {};
let rebotes = 0;
for (const [pid, v] of Object.entries(sent)) {
  const acc = v.account || "?"; sentByAcc[acc] = (sentByAcc[acc] || 0) + 1;
  const vr = v.variant || "v1"; sentByVariant[vr] = (sentByVariant[vr] || 0) + 1; if (v.to) emailToVariant[v.to.toLowerCase()] = vr;
  const d = (v.at || "").slice(0, 10); if (d) (byDay[d] = byDay[d] || { ini: 0, fu: 0 }).ini++;
  if (v.to && bounced.has(v.to.toLowerCase())) { bounceByAcc[acc] = (bounceByAcc[acc] || 0) + 1; rebotes++; }
}
for (const [pid, v] of Object.entries(fl)) { const d = (v.at || "").slice(0, 10); if (d) (byDay[d] = byDay[d] || { ini: 0, fu: 0 }).fu++; }

const contactados = Object.keys(sent).length;
const entregados = contactados - rebotes;
const fuEntries = Object.values(fl);
const seg1 = fuEntries.filter((v) => (v.n || 0) >= 1).length;
const seg2 = fuEntries.filter((v) => (v.n || 0) >= 2).length;
const respuestas = leads.length;
const interesados = leads.filter((l) => l.estado === "interesado").length;
const bajas = leads.filter((l) => l.estado === "baja").length;
const pct = (n, d) => (d ? (n / d * 100).toFixed(1) : "0") + "%";

const accounts = [...new Set([...Object.keys(sentByAcc)])];
const days = Object.keys(byDay).sort();
const maxDay = Math.max(1, ...days.map((d) => byDay[d].ini + byDay[d].fu));

const estadoColor = { interesado: "#1C8A5B", pregunta: "#1C8A5B", no_interesado: "#C9780A", baja: "#8A8790", fuera_oficina: "#8A8790", automatico: "#8A8790" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const funnel = [
  ["Contactados", contactados, "negocios con email enviado"],
  ["Entregados", entregados, `${pct(entregados, contactados)} · ${rebotes} rebotes`],
  ["Respuestas", respuestas, pct(respuestas, contactados) + " de contactados"],
  ["Interesados", interesados, pct(interesados, contactados) + " · leads"],
];

const accRows = accountReport(sent, bounced).map((a) => `<tr><td>${esc(a.account)}</td><td class="num">${a.sends}</td><td class="num">${a.days}d</td><td class="num" style="color:${a.bounceRate > 8 ? "#DC2330" : "#1C8A5B"}">${a.bounceRate}%</td><td class="num">${a.frozen ? "❄ congelada" : a.cap + "/día"}</td></tr>`).join("");
const dayRows = days.map((d) => { const o = byDay[d]; const tot = o.ini + o.fu; return `<div class="bar-row"><span class="bl">${d}</span><span class="bt"><span class="bf" style="width:${tot / maxDay * 100}%"></span></span><span class="bn">${tot} <span class="bsub">(${o.ini} ini · ${o.fu} seg)</span></span></div>`; }).join("");
const leadRows = leads.map((l) => `<tr>
  <td><b>${esc(l.negocio || l.email)}</b><div class="sub">${esc(l.email)}</div></td>
  <td><span class="badge" style="background:${estadoColor[l.estado] || "#8A8790"}">${esc(l.estado)}</span></td>
  <td>${esc(l.resumen)}</td>
  <td class="acc">${esc(l.accion)}</td>
</tr>`).join("");
const vw = variantWeights(sent, leads);
const repByVar = {}, intByVar = {};
for (const l of leads) { const vr = emailToVariant[(l.email || "").toLowerCase()] || "v1"; repByVar[vr] = (repByVar[vr] || 0) + 1; if (l.estado === "interesado") intByVar[vr] = (intByVar[vr] || 0) + 1; }
const varRows = [...new Set([...VARIANTS.map((v) => v.id), ...Object.keys(sentByVariant)])].map((id) => { const nombre = (VARIANTS.find((v) => v.id === id) || {}).nombre || ""; const s = sentByVariant[id] || 0, rp = repByVar[id] || 0, it = intByVar[id] || 0; return `<tr><td>${id} · ${esc(nombre)}</td><td class="num">${s}</td><td class="num">${rp}</td><td class="num">${pct(rp, s)}</td><td class="num">${it}</td></tr>`; }).join("");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Faro · Panel interno de outreach</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{ --ink:#16151A; --mut:#6A6770; --faint:#9A97A1; --line:#E9E7EC; --red:#DC2330; --green:#1C8A5B; --bg:#F4F3F6; }
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:15px;line-height:1.5}
  .wrap{max-width:1000px;margin:0 auto;padding:34px 26px 60px}
  h1{font-size:30px;font-weight:800;letter-spacing:-.02em;margin:0} .top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:26px}
  .top .d{color:var(--faint);font-size:13px}
  h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);font-weight:700;margin:34px 0 14px}
  .funnel{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .fcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px 22px}
  .fcard .n{font-size:42px;font-weight:800;letter-spacing:-.02em;line-height:1}
  .fcard .l{font-weight:600;margin-top:8px} .fcard .s{color:var(--mut);font-size:12.5px;margin-top:3px}
  .fcard.green .n{color:var(--green)} .fcard.red .n{color:var(--red)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:26px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}
  th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}
  td{padding:13px 14px;border-bottom:1px solid var(--line)} tr:last-child td{border-bottom:none}
  td.num,th.num{text-align:right} .sub{color:var(--faint);font-size:12px} .acc{color:var(--mut);font-size:13px}
  .badge{color:#fff;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:capitalize}
  .bar-row{display:grid;grid-template-columns:90px 1fr 150px;align-items:center;gap:12px;padding:6px 0}
  .bl{font-size:13px;color:var(--mut)} .bt{height:18px;background:#E7E5EA;border-radius:5px;overflow:hidden} .bf{display:block;height:100%;background:var(--ink);border-radius:5px}
  .bn{font-size:13px;font-weight:700} .bsub{color:var(--faint);font-weight:400;font-size:11.5px}
  .stages{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .scard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px} .scard .n{font-size:28px;font-weight:800} .scard .l{color:var(--mut);font-size:13px;margin-top:4px}
  .note{background:#fff;border:1px solid var(--line);border-left:3px solid var(--ink);border-radius:10px;padding:14px 16px;color:var(--mut);font-size:13px;margin-top:12px}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:4px 0}
</style></head><body><div class="wrap">
  <div class="top"><h1>Faro · Panel de outreach</h1><span class="d">Actualizado ${today()}</span></div>

  <h2>Embudo</h2>
  <div class="funnel">${funnel.map((f, i) => `<div class="fcard ${i === 3 ? "green" : i === 1 && rebotes > 0 ? "" : ""}"><div class="n">${f[1]}</div><div class="l">${f[0]}</div><div class="s">${f[2]}</div></div>`).join("")}</div>

  <div class="note">Almacén: <b>${colaListos}</b> informes listos para enviar · ${colaDesc} descartados por calidad · capacidad de envío ~${capDia}/día.</div>
  <div class="grid2">
    <div><h2>Salud por cuenta (rebotes y tope)</h2><table><thead><tr><th>Cuenta</th><th class="num">Enviados</th><th class="num">Antig.</th><th class="num">% rebote</th><th class="num">Tope hoy</th></tr></thead><tbody>${accRows}</tbody></table><div class="note">El tope sube con la antigüedad de la cuenta. Si una pasa del ~8% de rebotes se <b>congela</b> sola para proteger la entregabilidad del resto.</div></div>
    <div><h2>Por etapa</h2><div class="stages">
      <div class="scard"><div class="n">${contactados}</div><div class="l">Email inicial</div></div>
      <div class="scard"><div class="n">${seg1}</div><div class="l">Seguimiento 1</div></div>
      <div class="scard"><div class="n">${seg2}</div><div class="l">Seguimiento 2</div></div>
    </div>
    <h2>Variantes (experimento)</h2><table><thead><tr><th>Variante</th><th class="num">Enviados</th><th class="num">Respuestas</th><th class="num">% resp.</th><th class="num">Interes.</th></tr></thead><tbody>${varRows}</tbody></table>
    <div class="note">Reparto actual: ${vw.decided ? "<b>ponderado</b> (ya hay muestra)" : "<b>igual</b> — muestra insuficiente, aún no se decide nada (sería suerte)"} → ${Object.entries(vw.weights).map(([k, v]) => k + " " + Math.round(v * 100) + "%").join(" · ")}. Métrica = respuestas positivas. Umbral para decidir: 120 envíos/variante y 8 respuestas (llevamos ${vw.totalReplies}).</div></div>
  </div>

  <h2>Envíos por día</h2>
  <div class="card" style="padding:14px 18px">${dayRows}</div>

  <h2>Leads y respuestas (clasificadas por IA)</h2>
  <table><thead><tr><th>Negocio</th><th>Estado</th><th>Resumen</th><th>Qué haría Jordi</th></tr></thead><tbody>${leadRows || `<tr><td colspan="4" style="color:var(--faint)">Sin respuestas todavía.</td></tr>`}</tbody></table>
  <div class="note">Los <b>interesados</b> los cierras tú (salen del seguimiento automático). Las <b>bajas</b> (cerró / cambió de dueño) se descartan. El resto sigue su secuencia.</div>

</div></body></html>`;

const out = resolve(REPO_ROOT, "panel-interno.html");
writeFileSync(out, html, "utf8");
console.log(`Contactados ${contactados} · Entregados ${entregados} · Respuestas ${respuestas} · Interesados ${interesados} · Rebotes ${rebotes}`);
console.log(`→ ${out}`);
