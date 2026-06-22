// cola-day.mjs — arma el lote del día COGIENDO del almacén (cola.json): los N primeros
// "listo" que NO estén ya en sent-log (dedup por place_id y por email). Escribe
// envios-HOY-FECHA.json para que send-emails / send-followups / classify / build-stats
// trabajen igual que siempre. Idempotente: lo ya enviado nunca se vuelve a coger.
//   node src/cola-day.mjs [--limit N]   (por defecto ~60% de la capacidad de las cuentas)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { capacity } from "./lib/caps.mjs";
import { verifyMany } from "./lib/verify-email.mjs";

const args = process.argv.slice(2);
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const T = (p) => resolve(REPO_ROOT, "targets", p);
const norm = (e) => String(e || "").toLowerCase().replace(/\s+/g, "");

const cola = existsSync(T("cola.json")) ? JSON.parse(readFileSync(T("cola.json"), "utf8")) : { items: {} };
const sentLog = existsSync(T("sent-log.json")) ? JSON.parse(readFileSync(T("sent-log.json"), "utf8")) : {};
const inbox = existsSync(T(`inbox-state-${today()}.json`)) ? JSON.parse(readFileSync(T(`inbox-state-${today()}.json`), "utf8")) : { bouncedEmails: [] };
const bounced = new Set((inbox.bouncedEmails || []).map((e) => e.toLowerCase()));

const sentIds = new Set(Object.keys(sentLog));
const sentEmails = new Set(Object.values(sentLog).map((v) => norm(v.to)).filter(Boolean));

const cap = capacity(sentLog, bounced);
// Cogemos hasta la capacidad del día; send-emails respeta el tope por cuenta y descuenta los seguimientos.
const LIMIT = numAfter("--limit", Math.max(1, cap));

const candidates = Object.values(cola.items || {})
  .filter((it) => it.status === "listo" && !sentIds.has(it.place_id) && !sentEmails.has(norm(it.email))
    && existsSync(resolve(REPO_ROOT, "apps", "web", "audits", `${it.slug}.pdf`)))  // solo los que YA tienen PDF (si no, se saltarían)
  .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));

// Verificación GRATIS de buzón (MX vía DoH + sonda SMTP RCPT): descartamos las direcciones MUERTAS
// antes de enviar (es lo que causaba los rebotes). Verificamos un pool con margen para los descartes.
const pool = candidates.slice(0, Math.min(candidates.length, Math.ceil(LIMIT * 1.6)));
const verdicts = await verifyMany(pool.map((it) => it.email));
const pick = []; let deadDomains = 0;
for (const it of pool) {
  if (pick.length >= LIMIT) break;
  if (verdicts[String(it.email).toLowerCase().trim()] === "dead") { deadDomains++; continue; }
  pick.push({ priority: pick.length + 1, ...it });
}

const out = T(`envios-HOY-${today()}.json`);
writeFileSync(out, JSON.stringify(pick, null, 2), "utf8");
console.log(`Capacidad del día ~${cap} · candidatos a coger: ${LIMIT}`);
console.log(`Almacén listos disponibles: ${candidates.length} · descartados (buzón muerto verificado): ${deadDomains} · elegidos hoy: ${pick.length}`);
console.log(`→ ${out}\n  Siguiente: pdf-web --today  →  send-followups + send-emails`);
