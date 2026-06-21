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
// Reservamos ~60% de la capacidad del día para emails NUEVOS; el resto lo usan los seguimientos.
const LIMIT = numAfter("--limit", Math.max(1, Math.round(cap * 0.6)));

const candidates = Object.values(cola.items || {})
  .filter((it) => it.status === "listo" && !sentIds.has(it.place_id) && !sentEmails.has(norm(it.email)))
  .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
const pick = candidates.slice(0, LIMIT).map((r, i) => ({ priority: i + 1, ...r }));

const out = T(`envios-HOY-${today()}.json`);
writeFileSync(out, JSON.stringify(pick, null, 2), "utf8");
console.log(`Capacidad del día ~${cap} · reservado para nuevos: ${LIMIT}`);
console.log(`Almacén listos disponibles: ${candidates.length} · elegidos hoy: ${pick.length}`);
console.log(`→ ${out}\n  Siguiente: pdf-web --today  →  send-followups + send-emails`);
