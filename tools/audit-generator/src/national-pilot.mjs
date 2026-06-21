// national-pilot.mjs — sonda (throwaway): (1) prueba filtros server-side de
// DataForSEO; (2) analiza el CSV piloto para ver cuántos son "buen objetivo".
//   node src/national-pilot.mjs   (NECESITA RED → dangerouslyDisableSandbox)

import "./config.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";

const LOGIN = process.env.DATAFORSEO_LOGIN, PASSWORD = process.env.DATAFORSEO_PASSWORD;
const auth = "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
const ENDPOINT = "https://api.dataforseo.com/v3/business_data/business_listings/search/live";

async function show(label, task) {
  try {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify([task]) });
    const t = (await res.json()).tasks?.[0]; const r = t?.result?.[0];
    console.log(`  ${label.padEnd(26)} status ${t?.status_code} · cost $${t?.cost ?? 0} · total ${r?.total_count ?? "?"} · devueltos ${r?.count ?? 0}`);
  } catch (e) { console.log(`  ${label} → ${e.message}`); }
}

const M = "40.4168,-3.7038,20";
console.log("=== Filtros server-side (pilates Madrid) ===");
await show("sin filtro", { categories: ["pilates_studio"], location_coordinate: M, limit: 1000 });
await show("votes > 10", { categories: ["pilates_studio"], location_coordinate: M, filters: [["rating.votes_count", ">", 10]], limit: 1000 });
await show("votes 10-300", { categories: ["pilates_studio"], location_coordinate: M, filters: [["rating.votes_count", ">", 10], "and", ["rating.votes_count", "<", 300]], limit: 1000 });
await show("is_claimed=true", { categories: ["pilates_studio"], location_coordinate: M, filters: [["is_claimed", "=", true]], limit: 1000 });

// ── analizar CSV piloto ───────────────────────────────────────────────────────
function parseCsv(line) { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === ",") { out.push(cur); cur = ""; } else if (c === '"') q = true; else cur += c; } } out.push(cur); return out; }

const lines = readFileSync(resolve(REPO_ROOT, "targets", "negocios-espana-2026-06-05.csv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean);
let total = 0, web = 0, phone = 0, rev10 = 0, quality = 0, ghosts = 0;
for (const line of lines) {
  const c = parseCsv(line);
  const reviews = Number(c[3] || 0), site = c[5], tel = c[6];
  total++;
  if (site) web++;
  if (tel) phone++;
  if (reviews >= 10) rev10++;
  if (site && reviews >= 10 && reviews <= 300) quality++;       // buen objetivo EMAIL
  if (!site && reviews === 0) ghosts++;                          // ficha fantasma
}
console.log("\n=== Calidad del CSV piloto (12.600) ===");
console.log(`  total ${total} · con web ${web} (${(100 * web / total).toFixed(0)}%) · con tel ${phone} (${(100 * phone / total).toFixed(0)}%)`);
console.log(`  con ≥10 reseñas: ${rev10} (${(100 * rev10 / total).toFixed(0)}%)`);
console.log(`  BUEN OBJETIVO EMAIL (web + 10-300 reseñas): ${quality} (${(100 * quality / total).toFixed(0)}%)`);
console.log(`  fichas fantasma (sin web + 0 reseñas): ${ghosts} (${(100 * ghosts / total).toFixed(0)}%)`);
