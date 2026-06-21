// _diag-reviews.mjs — diagnóstico puntual: compara, por place_id, las reseñas
// del CSV (DataForSEO) · las guardadas en el JSON de hoy · y las que devuelve
// Google Places EN VIVO ahora mismo + el nombre/dirección que resuelve ese id.
// Sirve para detectar si el id apunta a otra ficha o si la cuenta está mal.
//   node src/_diag-reviews.mjs   (NECESITA RED → dangerouslyDisableSandbox)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { placeDetails } from "./lib/places.mjs";

function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }

const espLines = readFileSync(resolve(REPO_ROOT, "targets", `negocios-espana-${today()}.csv`), "utf8").split(/\r?\n/).filter(Boolean);
const head = parseCsv(espLines[0]);
const iId = head.indexOf("place_id"), iR = head.indexOf("reseñas"), iN = head.indexOf("negocio");
const csvMap = new Map();
for (const l of espLines.slice(1)) { const c = parseCsv(l); csvMap.set(c[iId], { reseñas: c[iR], negocio: c[iN] }); }

const j = JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`), "utf8"));
const sample = j.filter((r) => r.channel === "email").slice(0, 8);

console.log("negocio | CSV | JSON | LIVE | nombre resuelto en vivo");
for (const r of sample) {
  const csv = csvMap.get(r.place_id);
  let live = "?", name = "?";
  try { const p = await placeDetails(r.place_id); live = p.userRatingCount; name = (p.displayName?.text || "") + " — " + (p.formattedAddress || ""); }
  catch (e) { name = "ERR " + e.message; }
  console.log(`${r.negocio}  |  CSV ${csv?.reseñas}  |  JSON ${r.findings.reviews}  |  LIVE ${live}  |  ${name}`);
}
