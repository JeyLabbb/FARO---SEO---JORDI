// _qa.mjs — REVISIÓN DE CALIDAD del lote de HOY (whatsapp + email) + top 100
// llamadas. Chequea: datos en rango, sin valores rotos, mensajes sin fallos,
// email con gancho fuerte, y (con --live) spot-check contra Google (reseñas y
// ciudad). Imprime avisos.   node src/_qa.mjs --live  (--live NECESITA RED)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { subject, bodyText, waText } from "./lib/email-copy.mjs";
import { placeDetails } from "./lib/places.mjs";

const LIVE = process.argv.includes("--live");
const BAD = /undefined|NaN|\bnull\b/;
const flags = [];
const flag = (who, why) => flags.push(`  ⚠ [${who}] ${why}`);
function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }

// ── HOY (whatsapp + email) ──
const j = JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`), "utf8"));
const wa = j.filter((r) => r.channel === "whatsapp"), em = j.filter((r) => r.channel === "email");
let okMsg = 0;
for (const r of j) {
  const f = r.findings || {};
  if (!f || !Object.keys(f).length) { flag(r.negocio, "SIN findings"); continue; }
  if (f.businessVisibility != null && (f.businessVisibility < 0 || f.businessVisibility > 100)) flag(r.negocio, `visibilidad fuera de rango: ${f.businessVisibility}`);
  if (f.competitorVisibility != null && (f.competitorVisibility < 0 || f.competitorVisibility > 100)) flag(r.negocio, `comp-visibilidad fuera de rango: ${f.competitorVisibility}`);
  if (f.rating != null && (f.rating < 0 || f.rating > 5)) flag(r.negocio, `nota rara: ${f.rating}`);
  if (!(Number(f.reviews) >= 0)) flag(r.negocio, `reviews no numérico: ${f.reviews}`);
  if (f.bestCompetitor && !(Number(f.bestCompetitor.reviews) >= 0)) flag(r.negocio, `comp-reviews raro`);
  const msg = r.channel === "email" ? subject(f, r.negocio, r.ciudad) + "\n" + bodyText(f, r.negocio, r.ciudad) : waText(f, r.negocio, r.ciudad);
  if (BAD.test(msg)) flag(r.negocio, `mensaje con token roto (undefined/NaN/null)`);
  else if (!msg || msg.length < 40) flag(r.negocio, `mensaje muy corto`);
  else okMsg++;
  if (r.channel === "email") {
    const behind = f.posMeasured && f.businessVisibility != null && f.competitorVisibility != null && f.businessVisibility < f.competitorVisibility - 8;
    const revGap = f.bestCompetitor && f.reviews < f.bestCompetitor.reviews * 0.7;
    if (!behind && !revGap) flag(r.negocio, `email SIN gancho fuerte (ni detrás en visibilidad ni en reseñas)`);
  }
}
console.log(`══ HOY: ${j.length} (WhatsApp ${wa.length} + Email ${em.length}) · mensajes OK: ${okMsg}/${j.length} ══`);

// ── LLAMADAS top 100 ──
const L = readFileSync(resolve(REPO_ROOT, "targets", `lote-LLAMADAS-${today()}.csv`), "utf8").split(/\r?\n/).filter(Boolean);
const h = parseCsv(L[0]); const ix = (n) => h.indexOf(n);
const calls = L.slice(1).map(parseCsv).slice(0, 100);
let callOk = 0;
for (const c of calls) {
  const neg = c[ix("negocio")], ciu = c[ix("ciudad")], tel = c[ix("telefono")], rev = c[ix("reseñas")], not = c[ix("nota")];
  if (!neg) { flag("call", "fila sin negocio"); continue; }
  let bad = false;
  if (!ciu) { flag(neg, "sin ciudad"); bad = true; }
  if (!tel) { flag(neg, "sin teléfono"); bad = true; }
  if (rev && isNaN(parseInt(rev, 10))) { flag(neg, `reseñas no numérico: ${rev}`); bad = true; }
  if (not && isNaN(parseFloat(String(not).replace(",", ".")))) { flag(neg, `nota no numérica: ${not}`); bad = true; }
  if (!bad) callOk++;
}
console.log(`══ LLAMADAS: revisados ${calls.length} (top 100) · datos OK: ${callOk}/${calls.length} ══`);

// ── Spot-check EN VIVO (muestra) ──
if (LIVE) {
  const sample = [...wa.slice(0, 6), ...em.slice(0, 6)];
  console.log(`══ Spot-check EN VIVO (${sample.length}) — reseñas guardadas vs Google ahora + ciudad ══`);
  for (const r of sample) {
    try {
      const p = await placeDetails(r.place_id);
      const live = Number(p.userRatingCount) || 0, stored = Number(r.findings.reviews) || 0;
      const addr = p.formattedAddress || "";
      const cityOk = addr.toLowerCase().includes((r.ciudad || "").toLowerCase());
      const revOk = live === stored;
      console.log(`  ${revOk && cityOk ? "✓" : "✗"} ${r.negocio}: reseñas ${stored}/${live}${cityOk ? "" : " · ⚠CIUDAD"}  [${addr}]`);
      if (!revOk) flag(r.negocio, `reseñas guardado ${stored} ≠ vivo ${live}`);
      if (!cityOk) flag(r.negocio, `dirección "${addr}" no coincide con ciudad "${r.ciudad}"`);
    } catch (e) { console.log(`  ? ${r.negocio}: ${e.message}`); }
  }
}

console.log(`\n${flags.length ? `⚠ ${flags.length} AVISOS:\n` + flags.join("\n") : "✅ Sin avisos: datos y mensajes de hoy correctos."}`);
