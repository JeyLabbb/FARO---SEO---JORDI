// send-emails.mjs — envía los emails del día EN ORDEN DE PRIORIDAD (#1 primero),
// cada uno con SU PDF adjunto y un cuerpo corto con los problemas REALES del
// negocio (para que piquen a abrir el PDF). Rota entre las cuentas Gmail y
// registra cada envío en sent-log.json (que el dashboard lee para marcar
// "✅ Enviado" en orden).
//
//   node src/send-emails.mjs --dry [--limit 1]  → NO envía; imprime asunto+cuerpo (preview)
//   node src/send-emails.mjs --test             → envía SOLO el nº1 a TU correo (preview real en bandeja)
//   node src/send-emails.mjs --limit 5          → envía los 5 primeros (en orden)
//   node src/send-emails.mjs                     → envía toda la lista email de hoy
// NECESITA RED → dangerouslyDisableSandbox.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { sendMail, gmailAccounts } from "./lib/gmail-smtp.mjs";
import { VARIANTS } from "./lib/email-copy.mjs";
import { variantWeights, pickVariant } from "./lib/variant-policy.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const TEST = args.includes("--test");
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const LIMIT = numAfter("--limit", TEST ? 1 : Infinity);
const THROTTLE_MS = numAfter("--throttle", 45000); // ~45 s entre envíos (humano, anti-spam)
const TEST_TO = "borrutjordi548@gmail.com";

// Guardia anti-basura: descarta placeholders (tu@email.com) y dominios de ejemplo,
// y limpia espacios / %20 colados al raspar la web.
const PLACEHOLDER_DOMAINS = new Set(["email.com", "example.com", "example.org", "example.net", "domain.com", "dominio.com", "tudominio.com", "yourdomain.com", "test.com", "correo.com", "booksy.com", "treatwell.com", "treatwell.es", "doctoralia.com", "doctoralia.es", "topdoctors.es"]);
const PLACEHOLDER_LOCALS = new Set(["tu", "tucorreo", "tusdatos", "tuemail", "tunombre", "your", "youremail", "yourname", "ejemplo", "example", "nombre", "correo", "emailaddress", "abc", "xxx", "test", "asdf", "aaa"]);
function cleanEmail(e) { try { e = decodeURIComponent(String(e || "")); } catch { e = String(e || ""); } return e.replace(/\s+/g, "").toLowerCase(); }
function validEmail(raw) { const e = cleanEmail(raw); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return false; const [loc, dom] = e.split("@"); return !PLACEHOLDER_DOMAINS.has(dom) && !PLACEHOLDER_LOCALS.has(loc); }

if (!DRY && !TEST && existsSync(resolve(REPO_ROOT, "targets", "PARAR.flag"))) { console.error("⛔ FRENO: existe targets/PARAR.flag — no se envía nada. Bórralo para reanudar."); process.exit(0); }
const jsonPath = resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`);
if (!existsSync(jsonPath)) { console.error(`✗ No existe ${jsonPath}. Genera primero los audits (audit-batch).`); process.exit(1); }
const all = JSON.parse(readFileSync(jsonPath, "utf8"));
const emailRows = all.filter((r) => r.channel === "email" && r.findings);
let list = emailRows.filter((r) => validEmail(r.email) && (!r.qa || r.qa.pass)).sort((a, b) => a.priority - b.priority);
const dropped = emailRows.length - list.length;
if (!list.length) { console.error("✗ No hay negocios de canal email con email válido en el JSON de hoy."); process.exit(1); }
list = list.slice(0, LIMIT);

const logPath = resolve(REPO_ROOT, "targets", "sent-log.json");
const log = (() => { try { return existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : {}; } catch { return {}; } })();
// Dedup también por EMAIL (no solo por ficha): nunca dos primeros emails a la misma dirección.
const sentEmails = new Set(Object.values(log).map((v) => (v.to || "").toLowerCase()).filter(Boolean));
// Reparto de variantes según feedback: muestra insuficiente → igual; con datos → ponderado.
const leadFiles = (() => { try { return readdirSync(resolve(REPO_ROOT, "targets")).filter((n) => /^leads-.*\.json$/.test(n)).sort(); } catch { return []; } })();
const leads = leadFiles.length ? (() => { try { return JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", leadFiles[leadFiles.length - 1]), "utf8")); } catch { return []; } })() : [];
const { weights, decided } = variantWeights(log, leads);

const accs = gmailAccounts();
if (!accs.length && !DRY) { console.error("✗ No hay GMAIL_ACCOUNTS en ~/.faro/.env"); process.exit(1); }

const pdfFor = (slug) => resolve(REPO_ROOT, "apps", "web", "audits", `${slug}.pdf`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`${DRY ? "DRY-RUN (no envía)" : TEST ? `TEST → ${TEST_TO}` : "ENVÍO REAL"} · ${list.length} email(s)${dropped ? ` · ${dropped} descartados (email inválido/placeholder)` : ""}`);
console.log(`Variantes → reparto ${decided ? "PONDERADO (hay muestra)" : "igual (muestra insuficiente)"}: ${Object.entries(weights).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" · ")}\n`);

let sent = 0, skipped = 0;
for (let i = 0; i < list.length; i++) {
  const r = list[i];
  const variant = VARIANTS.find((v) => v.id === pickVariant(weights)) || VARIANTS[i % VARIANTS.length]; // variante elegida por feedback
  const subj = variant.subject(r.findings, r.negocio, r.ciudad);
  const body = variant.body(r.findings, r.negocio, r.ciudad);
  const pdf = pdfFor(r.slug);
  const hasPdf = existsSync(pdf);

  if (DRY) {
    console.log(`════════ #${r.priority} · ${r.negocio} (${r.ciudad}) → ${cleanEmail(r.email)} ${hasPdf ? "· PDF ✓" : "· ⚠ SIN PDF"}`);
    console.log(`ASUNTO: ${subj}\n`);
    console.log(body);
    console.log("\n");
    continue;
  }
  if (!hasPdf) { console.log(`  ⚠ #${r.priority} ${r.negocio}: falta ${r.slug}.pdf → salto`); skipped++; continue; }
  if (!TEST && (log[r.place_id] || sentEmails.has(cleanEmail(r.email)))) { console.log(`  ↷ #${r.priority} ${r.negocio}: ya contactado (ficha o email), salto`); skipped++; continue; }

  const acc = accs[sent % accs.length]; // rota cuentas Gmail
  const to = TEST ? TEST_TO : cleanEmail(r.email);
  try {
    await sendMail({ user: acc.user, pass: acc.pass, fromName: "Jordi de Faro", to, subject: subj, text: body, attachments: [{ path: pdf, filename: "analisis-faro.pdf" }] });
    sent++;
    console.log(`  ✓ #${r.priority} ${r.negocio} → ${to}  [${acc.user}]`);
    if (!TEST) { log[r.place_id] = { channel: "email", at: new Date().toISOString(), to: r.email, account: acc.user, variant: variant.id }; sentEmails.add(cleanEmail(r.email)); writeFileSync(logPath, JSON.stringify(log, null, 2), "utf8"); }
    if (i < list.length - 1) await sleep(THROTTLE_MS);
  } catch (e) {
    console.log(`  ✗ #${r.priority} ${r.negocio}: ${e.message}`);
  }
}

console.log(`\n${DRY ? "Preview hecho (no se ha enviado nada)." : `Enviados: ${sent} · Saltados: ${skipped}`}`);
if (!DRY && !TEST && sent) console.log(`→ Regenera el dashboard para ver los "Enviado": node src/build-ops.mjs`);
