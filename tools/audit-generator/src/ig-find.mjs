// ig-find.mjs — busca en Google Maps (API oficial) negocios con Instagram-COMO-web
// (sin web real) en varias ciudades → targets/instagram-FECHA.json, con su @ para
// poder mandarles DM directo. Candidatos perfectos para vender WEB + posicionamiento.
//   node src/ig-find.mjs ["Pamplona" "Madrid" ...]   · NECESITA RED
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { textSearch } from "./lib/places.mjs";

const CITIES = process.argv.slice(2).length ? process.argv.slice(2)
  : ["Pamplona", "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Bilbao", "Málaga", "Murcia", "Vitoria", "San Sebastián"];
// [consulta, clave-vertical] — verticales muy de Instagram y que suelen ir sin web.
const VERTS = [["centro de estética", "estetica"], ["peluquería", "peluqueria"], ["uñas", "unas"], ["barbería", "barberia"], ["estudio de tatuajes", "tatuajes"], ["pilates", "pilates"], ["fisioterapia", "fisioterapia"], ["restaurante", "restaurante"], ["cafetería de especialidad", "cafeteria"], ["floristería", "floristeria"], ["tienda de ropa", "ropa"]];
const handle = (w) => { const m = /instagram\.com\/([A-Za-z0-9_.]+)/i.exec(w || ""); return m ? m[1].replace(/\/$/, "") : null; };
async function mapLimit(items, limit, fn) { let i = 0; await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const idx = i++; await fn(items[idx]); } })); }

const jobs = [];
for (const city of CITIES) for (const [q, vert] of VERTS) jobs.push({ city, q, vert });

const seen = new Set(); const out = [];
await mapLimit(jobs, 5, async ({ city, q, vert }) => {
  let res = [];
  try { res = await textSearch(`${q} ${city}`, undefined, 20); } catch (e) { return; }
  for (const p of res) {
    if (!p.id || seen.has(p.id)) continue;
    const h = handle(p.websiteUri);
    if (!h) continue; // solo IG-como-web (los que podemos abrir directamente)
    seen.add(p.id);
    out.push({ place_id: p.id, negocio: p.displayName?.text || "", ciudad: city, vertical: vert, ig: h, handle: "@" + h, reviews: p.userRatingCount || 0, rating: p.rating ?? null, tel: p.nationalPhoneNumber || "" });
  }
});

out.sort((a, b) => b.reviews - a.reviews);
writeFileSync(resolve(REPO_ROOT, "targets", `instagram-${today()}.json`), JSON.stringify(out, null, 2), "utf8");
const byCity = {};
for (const o of out) byCity[o.ciudad] = (byCity[o.ciudad] || 0) + 1;
console.log(`✅ ${out.length} negocios con Instagram-como-web (sin web real):`);
for (const c of CITIES) console.log(`   ${c}: ${byCity[c] || 0}`);
console.log(`→ targets/instagram-${today()}.json`);
