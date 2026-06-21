// enrich-calls.mjs — para la lista de LLAMADAS, trae de Google Places el horario
// semanal (para "abierto ahora"), el teléfono VERIFICADO y el estado del negocio
// (operativo / cerrado). Escribe targets/call-enrich-FECHA.json (por place_id).
//   node src/enrich-calls.mjs [N]   (N = cuántos del top; def. 150) · NECESITA RED
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { placeDetails } from "./lib/places.mjs";

function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }
async function mapLimit(items, limit, fn) { let i = 0; await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const idx = i++; await fn(items[idx]); } })); }
const digits = (s) => String(s || "").replace(/\D/g, "");

const N = Number(process.argv[2]) || 150;
const L = readFileSync(resolve(REPO_ROOT, "targets", `lote-LLAMADAS-${today()}.csv`), "utf8").split(/\r?\n/).filter(Boolean);
const head = parseCsv(L[0]); const ix = (n) => head.indexOf(n);
const rows = L.slice(1).map(parseCsv).slice(0, N).map((c) => ({ place_id: c[ix("place_id")], negocio: c[ix("negocio")], tel: c[ix("telefono")] })).filter((r) => r.place_id);

const out = {};
let done = 0, mismatch = 0, closed = 0, noHours = 0;
await mapLimit(rows, 5, async (r) => {
  try {
    const p = await placeDetails(r.place_id);
    const periods = p.regularOpeningHours?.periods || null;
    const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || null;
    const status = p.businessStatus || null;
    out[r.place_id] = { periods, phone, status };
    if (phone && digits(r.tel).slice(-9) && digits(phone).slice(-9) !== digits(r.tel).slice(-9)) { mismatch++; console.log(`  ☎ corregido ${r.negocio}: ${r.tel} → ${phone}`); }
    if (status && status !== "OPERATIONAL") { closed++; console.log(`  ⛔ ${r.negocio}: ${status}`); }
    if (!periods) noHours++;
  } catch (e) { /* place caducado u otro: lo dejamos sin enriquecer */ }
  done++; if (done % 40 === 0) console.log(`  …${done}/${rows.length}`);
});

writeFileSync(resolve(REPO_ROOT, "targets", `call-enrich-${today()}.json`), JSON.stringify(out), "utf8");
console.log(`\n✅ Enriquecidos ${Object.keys(out).length}/${rows.length} · teléfonos corregidos: ${mismatch} · cerrados/no-operativos: ${closed} · sin horario: ${noHours}`);
