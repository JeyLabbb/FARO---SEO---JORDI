// national-search.mjs — BARRIDO de negocios por toda España (Prioridad 5, escala).
// Recorre ciudades × verticales con DataForSEO Business Listings (barato: ~$0.013
// por llamada, hasta 1000 negocios cada una), deduplica por place_id, puntúa la
// "oportunidad" de cada ficha y vuelca un CSV listo para outreach.
//
//   node src/national-search.mjs                 (todas las ciudades)
//   node src/national-search.mjs --cities 3       (piloto: primeras 3 ciudades)
//   node src/national-search.mjs --verticals "pilates,fisioterapia" --radius 20 --per 1000
//
// NECESITA RED → dangerouslyDisableSandbox. Imprime el GASTO real al final.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { HAS_DATAFORSEO, businessListings, dfsSpend } from "./lib/dataforseo.mjs";
import { today } from "./lib/slug.mjs";

// Ciudades de España (núcleo de población). Radio cubre el área metropolitana.
const CITIES = [
  ["Madrid", 40.4168, -3.7038], ["Barcelona", 41.3874, 2.1686], ["Valencia", 39.4699, -0.3763],
  ["Sevilla", 37.3891, -5.9845], ["Zaragoza", 41.6488, -0.8891], ["Málaga", 36.7213, -4.4214],
  ["Murcia", 37.9922, -1.1307], ["Palma", 39.5696, 2.6502], ["Las Palmas", 28.1235, -15.4363],
  ["Bilbao", 43.263, -2.935], ["Alicante", 38.3452, -0.481], ["Córdoba", 37.8882, -4.7794],
  ["Valladolid", 41.6523, -4.7245], ["Vigo", 42.2406, -8.7207], ["Gijón", 43.5322, -5.6611],
  ["A Coruña", 43.3623, -8.4115], ["Vitoria", 42.8467, -2.6716], ["Granada", 37.1773, -3.5986],
  ["Elche", 38.2699, -0.7126], ["Oviedo", 43.3619, -5.8494], ["Cartagena", 37.6257, -0.9966],
  ["Tarragona", 41.1189, 1.2445], ["Jerez", 36.685, -6.1261], ["Sabadell", 41.5463, 2.1086],
  ["Móstoles", 40.3223, -3.8649], ["Santa Cruz de Tenerife", 28.4636, -16.2518],
  ["Pamplona", 42.8125, -1.6458], ["Almería", 36.834, -2.4637], ["San Sebastián", 43.3183, -1.9812],
  ["Burgos", 42.3439, -3.6969], ["Santander", 43.4623, -3.8099], ["Castellón", 39.9864, -0.0513],
  ["Albacete", 38.9943, -1.8585], ["Getafe", 40.3057, -3.7327], ["Logroño", 42.4627, -2.4449],
  ["Badajoz", 38.8794, -6.9707], ["Salamanca", 40.9701, -5.6635], ["Huelva", 37.2614, -6.9447],
  ["Lleida", 41.6176, 0.62], ["Marbella", 36.5101, -4.8826], ["León", 42.5987, -5.5671],
  ["Cádiz", 36.5298, -6.2924], ["Jaén", 37.7796, -3.7849], ["Ourense", 42.3358, -7.8639],
  ["Girona", 41.9794, 2.8214], ["Lugo", 43.0121, -7.5559], ["Cáceres", 39.4753, -6.3724],
  ["Toledo", 39.8628, -4.0273], ["Guadalajara", 40.6286, -3.1641], ["Tudela", 42.0648, -1.6064],
];

const VERTICALS = {
  pilates: ["pilates_studio"],
  fisioterapia: ["physiotherapist"],
  dental: ["dental_clinic", "dentist"],
  estetica: ["beauty_salon", "skin_care_clinic"],
  peluqueria: ["hair_salon"],
};

function parseArgs(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2), n = argv[i + 1];
    if (n === undefined || n.startsWith("--")) f[k] = true; else (f[k] = n, i++);
  }
  return f;
}

function opportunity(b) {
  let score = 0; const gaps = [];
  if (!b.website) { score += 3; gaps.push("sin web"); }
  const rev = b.reviews ?? 0;
  if (rev < 15) { score += 3; gaps.push(`${rev} reseñas`); }
  else if (rev < 40) { score += 2; }
  else if (rev < 80) { score += 1; }
  if (b.rating != null && b.rating < 4.3) { score += 1; gaps.push(`nota ${b.rating}`); }
  if (b.rating == null) { score += 1; gaps.push("sin nota"); }
  return { score, gaps };
}

const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

async function main() {
  if (!HAS_DATAFORSEO) { console.error("Faltan credenciales DataForSEO en ~/.faro/.env"); process.exit(1); }
  const f = parseArgs(process.argv.slice(2));
  const nCities = f.cities ? Number(f.cities) : CITIES.length;
  const cities = CITIES.slice(0, nCities);
  const radius = Number(f.radius || 20);
  const limit = Number(f.per || 1000);
  const verticals = typeof f.verticals === "string"
    ? f.verticals.split(",").map((s) => s.trim()).filter((v) => VERTICALS[v])
    : Object.keys(VERTICALS);

  console.log(`\nBarrido: ${cities.length} ciudades × ${verticals.length} verticales (radio ${radius}km, hasta ${limit}/llamada)\n`);

  const byId = new Map();
  let calls = 0;
  for (const [city, lat, lng] of cities) {
    let cityCount = 0;
    for (const v of verticals) {
      let items = [];
      try { items = await businessListings(VERTICALS[v], lat, lng, { radius, limit }); calls++; }
      catch (e) { console.error(`  ! ${city}/${v}: ${e.message}`); continue; }
      for (const b of items) {
        if (!b.place_id || byId.has(b.place_id)) continue;
        byId.set(b.place_id, { city, vertical: v, ...b });
        cityCount++;
      }
    }
    console.log(`  ${city.padEnd(22)} +${cityCount} nuevos  (total ${byId.size})`);
  }

  // ── Curar: "buen objetivo EMAIL" = web (para sacar email) + establecido con recorrido ──
  const RAW = f.raw === true;
  const minRev = Number(f.minrev || 10), maxRev = Number(f.maxrev || 300), cap = Number(f.cap || 5000);
  const lead = (b) => {
    const rev = b.reviews ?? 0; let s = 0;
    if (b.website) s += 2; if (b.phone) s += 1;
    if (rev >= 10 && rev <= 120) s += 3; else if (rev > 120 && rev <= maxRev) s += 1;
    if (b.rating != null && b.rating < 4.6) s += 1;     // hueco = el pitch entra
    return s;
  };
  let rows = [...byId.values()].map((b) => ({ ...b, lead: lead(b) }));
  const rawTotal = rows.length;
  if (!RAW) rows = rows.filter((b) => b.website && (b.reviews ?? 0) >= minRev && (b.reviews ?? 0) <= maxRev);
  rows.sort((a, b) => b.lead - a.lead || (a.reviews ?? 0) - (b.reviews ?? 0));
  const curated = rows.length;
  if (!RAW && rows.length > cap) rows = rows.slice(0, cap);

  // CSV
  const head = ["ciudad", "vertical", "negocio", "reseñas", "nota", "web", "telefono", "place_id", "lead"];
  const csv = [head.join(",")].concat(rows.map((r) => [
    r.city, r.vertical, r.name, r.reviews ?? "", r.rating ?? "", r.website || "", r.phone || "", r.place_id, r.lead,
  ].map(esc).join(","))).join("\n");

  const outDir = f.out ? (isAbsolute(f.out) ? f.out : resolve(process.cwd(), f.out)) : resolve(REPO_ROOT, "targets");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `negocios-espana-${RAW ? "crudo-" : ""}${today()}.csv`);
  writeFileSync(outPath, csv, "utf8");

  // resumen
  const byVert = {}; for (const r of rows) byVert[r.vertical] = (byVert[r.vertical] || 0) + 1;
  const withTel = rows.filter((r) => r.phone).length;
  console.log(`\n──────── RESUMEN ────────`);
  console.log(`  Encontrados (bruto, dedup): ${rawTotal}`);
  if (!RAW) console.log(`  Buen objetivo email (web + ${minRev}-${maxRev} reseñas): ${curated}  → guardados ${rows.length} (cap ${cap})`);
  console.log(`  Por vertical: ${Object.entries(byVert).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  console.log(`  Con teléfono (WhatsApp-ables): ${withTel}/${rows.length}`);
  console.log(`  Llamadas DataForSEO: ${calls}  ·  💰 GASTO (este barrido): $${dfsSpend().toFixed(4)}`);
  console.log(`  CSV: ${outPath}\n`);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
