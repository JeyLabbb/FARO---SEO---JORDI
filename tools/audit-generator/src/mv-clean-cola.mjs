// mv-clean-cola.mjs — limpia el almacén (cola.json) con MillionVerifier: verifica los
// emails de los informes AÚN NO enviados, DESCARTA las direcciones muertas (invalid/
// disposable) y etiqueta el resto (mv: ok | unknown) para poder priorizar "ok" al enviar.
// Mata los rebotes en seco. Usa caché (no recobra créditos). NECESITA RED + key.
//   node src/mv-clean-cola.mjs [--limit N] [--all]
//   --all = verifica también los ya enviados (normalmente no hace falta)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { mvVerify, saveMvCache, HAS_MV } from "./lib/millionverifier.mjs";

const args = process.argv.slice(2);
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const LIMIT = numAfter("--limit", Infinity);
const ALL = args.includes("--all");

const T = (p) => resolve(REPO_ROOT, "targets", p);
const colaPath = T("cola.json");
if (!HAS_MV) { console.error("✗ Sin MILLIONVERIFIER_API_KEY en ~/.faro/.env. Aborto (no quiero usar el verificador gratis sin avisar)."); process.exit(1); }
const cola = JSON.parse(readFileSync(colaPath, "utf8"));
cola.items = cola.items || {}; cola.descartados = cola.descartados || {};
const sentLog = existsSync(T("sent-log.json")) ? JSON.parse(readFileSync(T("sent-log.json"), "utf8")) : {};

// Candidatos: items 'listo' con email, SIN veredicto mv aún; por defecto solo los NO enviados.
let cand = Object.values(cola.items).filter((i) => i.status === "listo" && i.email && !i.mv && (ALL || !sentLog[i.place_id]));
if (Number.isFinite(LIMIT)) cand = cand.slice(0, LIMIT);

console.log(`MillionVerifier · ${cand.length} emails a verificar (almacén: ${Object.values(cola.items).length} items)…\n`);
const save = () => writeFileSync(colaPath, JSON.stringify(cola, null, 2), "utf8");
let ok = 0, dead = 0, unknown = 0, done = 0, idx = 0;

async function worker() {
  while (idx < cand.length) {
    const it = cand[idx++];
    const r = await mvVerify(it.email);
    done++;
    if (r.verdict === "dead") {
      cola.descartados[it.place_id] = "MillionVerifier: " + r.result;
      delete cola.items[it.place_id];
      dead++;
      console.log(`  ✗ DEAD  ${it.email}  (${r.result})  — ${it.negocio}`);
    } else {
      it.mv = { verdict: r.verdict, result: r.result, at: new Date().toISOString() };
      if (r.verdict === "ok") ok++; else unknown++;
    }
    if (done % 20 === 0) { save(); saveMvCache(); console.log(`  … ${done}/${cand.length}  (ok ${ok} · dead ${dead} · unknown ${unknown})`); }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
save(); saveMvCache();

const desplegables = Object.values(cola.items).filter((i) => i.status === "listo" && i.email && !sentLog[i.place_id]).length;
console.log(`\nVerificados ${done} · ok ${ok} · unknown/catch-all ${unknown} · DESCARTADOS ${dead} muertos.`);
console.log(`Almacén ahora: ${Object.values(cola.items).length} items · ${desplegables} desplegables sin enviar.`);
console.log(`→ ${colaPath}`);
