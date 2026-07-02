// send-followups.mjs — envía SEGUIMIENTOS (Re:) a los negocios ya contactados que
// NO han respondido ni rebotado. SIN PDF (el PDF solo va en el primer email).
// Cadencia: siguiente toque a los SPACING días del anterior; MÁX 3 toques.
// Idempotente vía followup-log.json. Sale desde la MISMA cuenta del envío inicial.
// Exclusiones: rebotes + respuestas (por place_id, email Y nombre del negocio) +
// lista dura de leads que se queda Jordi.
//   node src/send-followups.mjs [--limit 25] [--spacing 2] [--throttle 45000] [--dry|--test]
// NECESITA RED → dangerouslyDisableSandbox.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { sendMail, gmailAccounts } from "./lib/gmail-smtp.mjs";
import { followupBody, variantById } from "./lib/email-copy.mjs";
import { accountReport } from "./lib/caps.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry"), TEST = args.includes("--test");
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const LIMIT = numAfter("--limit", 25);
const SCHEDULE = [2, 5];            // días desde el envío INICIAL para el toque 1 y el 2 (cadencia decidida: +2 y +5)
const THROTTLE = numAfter("--throttle", 45000);
const TEST_TO = "borrutjordi548@gmail.com";
const DAY = 86400000;

if (!DRY && !TEST && existsSync(resolve(REPO_ROOT, "targets", "PARAR.flag"))) { console.error("⛔ FRENO: existe targets/PARAR.flag — no se envían seguimientos. Bórralo para reanudar."); process.exit(0); }
const T = (p) => resolve(REPO_ROOT, "targets", p);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// 1) contactados (envío inicial)
const sent = JSON.parse(readFileSync(T("sent-log.json"), "utf8"));

// 2) findings para redactar el seguimiento. ⚠️ Los envios-HOY-*.json están GITIGNORED →
// en la nube solo existe el de HOY y todos los contactos anteriores caían en "sin findings"
// (seguimientos a 0 desde el 06-22). El almacén (cola.json, VERSIONADO) guarda los findings
// de cada item aunque ya se haya enviado → es la fuente fiable; envios-HOY solo complementa.
const fmap = new Map();
try {
  const cola = JSON.parse(readFileSync(T("cola.json"), "utf8"));
  for (const [pid, it] of Object.entries(cola.items || {})) if (it.findings) fmap.set(pid, { negocio: it.negocio, ciudad: it.ciudad, findings: it.findings });
} catch {}
for (const f of readdirSync(resolve(REPO_ROOT, "targets")).filter((n) => /^envios-HOY-.*\.json$/.test(n))) {
  try { for (const r of JSON.parse(readFileSync(T(f), "utf8"))) if (r.place_id && r.findings && !fmap.has(r.place_id)) fmap.set(r.place_id, { negocio: r.negocio, ciudad: r.ciudad, findings: r.findings }); } catch {}
}

// 3) inbox-state → exclusiones (rebotes + respuestas)
const ours = new Set(gmailAccounts().map((a) => a.user));
function parseName(subj) {
  let s = String(subj || "").replace(/^re:\s*/i, "").trim(), m;
  if ((m = s.match(/cómo aparece (.+?) en Google/i))) return m[1];
  if ((m = s.match(/^(.+?)\s+—\s+por qué/i))) return m[1];
  if ((m = s.match(/antes que (.+)$/i))) return m[1];
  if ((m = s.match(/^Te busqué en Google,\s*(.+)$/i))) return m[1];
  return null;
}
let bouncedIds = new Set(), bouncedEmails = new Set(), repliedIds = new Set(), repliedEmails = new Set(), repliedNames = [];
try {
  const st = JSON.parse(readFileSync(T(`inbox-state-${today()}.json`), "utf8"));
  bouncedIds = new Set(st.bouncedPlaceIds || []);
  bouncedEmails = new Set((st.bouncedEmails || []).map((e) => e.toLowerCase()));
  for (const r of st.replies || []) {
    if (!/^re:/i.test(r.subject || "") || ours.has(r.fromEmail)) continue;
    if (r.placeId) repliedIds.add(r.placeId);
    if (r.fromEmail) repliedEmails.add(r.fromEmail.toLowerCase());
    const nm = parseName(r.subject); if (nm) repliedNames.push(norm(nm));
  }
} catch (e) { console.log("⚠ sin inbox-state de hoy:", e.message); }
// leads que se queda Jordi (no tocar nunca)
const HARD_EMAILS = new Set([
  "martadental1963@hotmail.com", "clinicadentalserreria@gmail.com",
  "mimosibeauty@gmail.com",            // interesada (WhatsApp) 01-07
  "info@clinicasaludymas.com",         // preguntó el coste 02-07
  "integracontacte@gmail.com",         // Team Fisioterapia: dio su teléfono 01-07
]);
const nameExcluded = (neg) => { const n = norm(neg); return repliedNames.some((rn) => rn && (rn === n || n.includes(rn) || rn.includes(n))); };

// 4) followup-log (idempotencia)
const flPath = T("followup-log.json");
const fl = existsSync(flPath) ? JSON.parse(readFileSync(flPath, "utf8")) : {};

const now = Date.now();
const accByUser = new Map(gmailAccounts().map((a) => [a.user, a]));

let nB = 0, nR = 0, nNoF = 0, nWait = 0, nDone = 0;
const elig = [];
for (const [pid, info] of Object.entries(sent)) {
  if (info.channel && info.channel !== "email") continue;
  const to = (info.to || "").toLowerCase();
  const fdata = fmap.get(pid);
  if (!fdata) { nNoF++; continue; }
  if (bouncedIds.has(pid) || bouncedEmails.has(to)) { nB++; continue; }
  if (repliedIds.has(pid) || repliedEmails.has(to) || HARD_EMAILS.has(to) || nameExcluded(fdata.negocio)) { nR++; continue; }
  const prev = fl[pid];
  const n = (prev?.n || 0) + 1;
  if (n > SCHEDULE.length) { nDone++; continue; }
  const initialAt = Date.parse(info.at);
  const dueAt = initialAt + SCHEDULE[n - 1] * DAY;   // anclado al envío inicial: toque 1 a +2, toque 2 a +5
  if (isNaN(initialAt) || now < dueAt) { nWait++; continue; }
  // No revivir secuencias RANCIAS: si el inicial tiene >14 días, un "Re:" ahora queda raro
  // (pasa al reactivar seguimientos tras el apagón: cientos de viejos quedarían "due").
  if (now - initialAt > 14 * DAY) { nDone++; continue; }
  elig.push({ pid, to, account: info.account, at: info.at, n, variant: info.variant || "v1", ...fdata });
}
elig.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); // más antiguos primero
const list = elig.slice(0, TEST ? 1 : LIMIT);

console.log(`${DRY ? "DRY-RUN (no envía)" : TEST ? `TEST → ${TEST_TO}` : "ENVÍO REAL"} · seguimientos`);
console.log(`Excluidos → rebotes:${nB} · respuestas/leads:${nR} · sin findings:${nNoF} · ya 2 toques:${nDone} · esperando turno:${nWait}`);
console.log(`Elegibles ahora: ${elig.length} · a enviar: ${list.length}\n`);

// Tope por cuenta también en seguimientos (respeta ramp/throttle/spam/pausa de caps.mjs):
// un seguimiento cuenta igual que un envío para la reputación de la cuenta.
const capByAcc = {}; for (const a of accountReport(sent, bouncedEmails)) capByAcc[a.account] = a.cap;
const loadByAcc = {}; const todayStr2 = today();
for (const v of Object.values(sent)) if ((v.at || "").slice(0, 10) === todayStr2 && v.account) loadByAcc[v.account] = (loadByAcc[v.account] || 0) + 1;
for (const v of Object.values(fl)) if ((v.at || "").slice(0, 10) === todayStr2 && v.account) loadByAcc[v.account] = (loadByAcc[v.account] || 0) + 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0;
for (let i = 0; i < list.length; i++) {
  const r = list[i];
  const subj = `Re: ${variantById(r.variant).subject(r.findings, r.negocio, r.ciudad)}`;
  const body = followupBody(r.n, r.findings, r.negocio, r.ciudad);
  if (DRY) { console.log(`──#${i + 1} · toque ${r.n} · ${r.negocio} (${r.ciudad}) → ${r.to} [${r.account}]\nASUNTO: ${subj}\n${body}\n`); continue; }
  const acc = accByUser.get(r.account) || gmailAccounts()[okN % gmailAccounts().length];
  if (!TEST && (loadByAcc[acc.user] || 0) >= (capByAcc[acc.user] ?? 0)) { console.log(`  ⏸ ${r.negocio}: cuenta ${acc.user} al tope/frenada hoy — salto`); continue; }
  const to = TEST ? TEST_TO : r.to;
  try {
    await sendMail({ user: acc.user, pass: acc.pass, fromName: "Jordi de Faro", to, subject: subj, text: body });
    okN++; loadByAcc[acc.user] = (loadByAcc[acc.user] || 0) + 1;
    console.log(`  ✓ toque ${r.n} · ${r.negocio} → ${to} [${acc.user}]`);
    if (!TEST) { fl[r.pid] = { n: r.n, at: new Date().toISOString(), account: acc.user }; writeFileSync(flPath, JSON.stringify(fl, null, 2), "utf8"); }
    if (i < list.length - 1) await sleep(THROTTLE);
  } catch (e) { console.log(`  ✗ ${r.negocio}: ${e.message}`); }
}
console.log(`\n${DRY ? "Preview hecho." : `Seguimientos enviados: ${okN}`}`);
