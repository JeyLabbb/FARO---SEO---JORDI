// call-sheet.mjs — HOJA DE LLAMADAS para HOY.
// Coge la lista curada de negocios y la convierte en una hoja lista para
// LLAMAR: prioriza verticales con dinero (dental/estética/fisio), pone teléfono
// + un gancho por negocio. El teléfono es el canal que hace volumen YA: cero
// baneo, cero warm-up, máximo cierre. Sin gastar nada (usa el CSV que ya tenemos).
//
//   node src/call-sheet.mjs [archivo.csv] [--top 400]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";

// Verticales ordenadas por TICKET/dinero (el cliente que más paga primero).
const PRIO = { dental: 1, estetica: 2, fisioterapia: 3, pilates: 4, peluqueria: 5 };

function parseCsv(line) { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === ",") { out.push(cur); cur = ""; } else if (c === '"') q = true; else cur += c; } } out.push(cur); return out; }
const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// gancho por negocio, a partir de lo que ya sabemos (sin llamadas API extra)
function gancho(b) {
  const v = { dental: "dentista", estetica: "centro de estética", fisioterapia: "fisio", pilates: "pilates", peluqueria: "peluquería" }[b.vertical] || b.vertical;
  if (b.reviews && b.reviews < 35) return `Solo ${b.reviews} reseñas para «${v} ${b.city}» — fácil de subir y salir más arriba en el mapa`;
  if (b.rating && b.rating < 4.5) return `Nota ${b.rating}: se sube respondiendo reseñas y pidiéndolas bien; y subimos su posición`;
  return `Tiene margen para salir más arriba cuando buscan «${v} ${b.city}»; le preparamos análisis gratis`;
}

const args = process.argv.slice(2);
const top = (() => { const i = args.indexOf("--top"); return i >= 0 ? Number(args[i + 1]) : 400; })();
const file = args.find((a) => !a.startsWith("--") && a.endsWith(".csv"));
const src = file ? (isAbsolute(file) ? file : resolve(process.cwd(), file)) : resolve(REPO_ROOT, "targets", `negocios-espana-${today()}.csv`);

const lines = readFileSync(src, "utf8").split(/\r?\n/).filter(Boolean);
const header = parseCsv(lines[0]);
const idx = (name) => header.indexOf(name);
const rows = lines.slice(1).map(parseCsv).map((c) => ({
  city: c[idx("ciudad")], vertical: c[idx("vertical")], name: c[idx("negocio")],
  reviews: Number(c[idx("reseñas")]) || null, rating: Number(c[idx("nota")]) || null,
  website: c[idx("web")], phone: c[idx("telefono")], lead: Number(c[idx("lead")]) || 0,
})).filter((b) => b.phone); // solo con teléfono (para llamar)

rows.sort((a, b) => (PRIO[a.vertical] || 9) - (PRIO[b.vertical] || 9) || b.lead - a.lead || (a.reviews ?? 999) - (b.reviews ?? 999));
const pick = rows.slice(0, top);

const head = ["#", "vertical", "negocio", "ciudad", "telefono", "reseñas", "nota", "web", "gancho_para_la_llamada"];
const csv = [head.join(",")].concat(pick.map((b, i) => [
  i + 1, b.vertical, b.name, b.city, b.phone, b.reviews ?? "", b.rating ?? "", b.website || "", gancho(b),
].map(esc).join(","))).join("\n");

const out = resolve(REPO_ROOT, "targets", `llamadas-HOY-${today()}.csv`);
writeFileSync(out, csv, "utf8");

const byVert = {}; for (const b of pick) byVert[b.vertical] = (byVert[b.vertical] || 0) + 1;
console.log(`\nHoja de llamadas: ${pick.length} negocios (de ${rows.length} con teléfono)`);
console.log(`Por vertical: ${Object.entries(byVert).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
console.log(`Archivo: ${out}\n`);
