// panel-snapshot.mjs — EL ROBOT SEMANAL.
// Re-mide cada cliente activo (posición real en Map Pack + ficha + reseñas) y
// guarda un snapshot de hoy → así se construye el histórico real con el tiempo.
//
//   node src/panel-snapshot.mjs            (todos los clientes activos)
//   node src/panel-snapshot.mjs pagadi     (solo ese slug)
//
// NECESITA RED → ejecutar con dangerouslyDisableSandbox.
// Pensado para correr 1×/semana (cron de Vercel, GitHub Actions o Tarea de Windows).

import { listActiveClients, clientKeywords, snapshotClient, today } from "./lib/panel.mjs";

const onlySlug = process.argv[2];

const all = await listActiveClients();
const clients = all.filter((c) => !onlySlug || c.slug === onlySlug);
if (!clients.length) { console.error(onlySlug ? `No hay cliente con slug "${onlySlug}".` : "No hay clientes activos."); process.exit(1); }

console.log(`Medición ${today()} · ${clients.length} cliente(s)\n`);
let ok = 0;
for (const c of clients) {
  const kws = await clientKeywords(c.id);
  try {
    const r = await snapshotClient(c, kws);
    ok++;
    console.log(`✓ ${c.name}`);
    console.log(`    visibilidad ${r.vis}/100 · pos media ${r.avgPos}º · ${r.reviews} reseñas${r.rating ? ` (${r.rating}★)` : ""} · MapPack ${r.mapPackReal ? "REAL" : "aprox"}`);
    if (r.keywords.length) console.log(`    posiciones: ${r.keywords.join(" · ")}`);
  } catch (e) {
    console.error(`✗ ${c.name}: ${e.message}`);
  }
}
console.log(`\nListo: ${ok}/${clients.length} medidos y guardados.`);
