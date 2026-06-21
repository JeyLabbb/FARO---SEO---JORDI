// panel-add-client.mjs — ALTA DE UN CLIENTE NUEVO en 1 comando.
// Crea su login + su ficha (clients) + lo vincula (client_users) + hace la
// PRIMERA medición real (snapshot + rankings + competidores + reseñas).
// A partir de ahí, panel-snapshot.mjs lo re-mide solo cada semana.
//
//   node src/panel-add-client.mjs --name "Clínica X" --city Pamplona \
//        --email dueño@clinicax.com --password "claveinicial" \
//        --website https://clinicax.com \
//        --keywords "fisioterapia pamplona; fisio cerca de mí; recuperación lesiones pamplona"
//
// NECESITA RED → ejecutar con dangerouslyDisableSandbox.

import { upsertClient, ensureUser, linkUser, snapshotClient } from "./lib/panel.mjs";

// ── parse args --clave valor ──────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true";
}
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const name = args.name, email = args.email, password = args.password;
if (!name || !email || !password) {
  console.error('Faltan campos. Mínimo: --name "Negocio" --email dueño@x.com --password "clave"');
  console.error('Opcionales: --city Pamplona --website https://... --keywords "kw1; kw2; kw3" --slug xxx --place-id ChIJ...');
  process.exit(1);
}
const keywords = (args.keywords && args.keywords !== "true" ? args.keywords : "").split(/[;|]/).map((s) => s.trim()).filter(Boolean);

(async () => {
  console.log(`Alta de cliente: ${name}\n`);

  const userId = await ensureUser(email, password);
  console.log(`  ✓ login: ${email}`);

  const client = await upsertClient({
    slug: args.slug && args.slug !== "true" ? args.slug : slugify(name),
    name,
    city: args.city && args.city !== "true" ? args.city : "Pamplona",
    website: args.website && args.website !== "true" ? args.website : null,
    google_place_id: args["place-id"] && args["place-id"] !== "true" ? args["place-id"] : null,
    brand: "Faro",
    active: true,
  });
  console.log(`  ✓ ficha: ${client.name} (slug ${client.slug})`);

  await linkUser(client.id, userId);
  console.log(`  ✓ acceso vinculado`);

  if (!keywords.length) {
    console.log("\n⚠ Sin --keywords: creada la ficha y el login, pero NO se midió posición.");
    console.log("  Añade keywords y corre:  node src/panel-snapshot.mjs " + client.slug);
    return;
  }

  console.log(`\n  Midiendo (${keywords.length} búsquedas)… puede tardar unos segundos`);
  const r = await snapshotClient(client, keywords);
  console.log(`  ✓ primera medición: visibilidad ${r.vis}/100 · pos media ${r.avgPos}º · ${r.reviews} reseñas · MapPack ${r.mapPackReal ? "REAL" : "aprox"}`);
  if (r.keywords.length) console.log(`    ${r.keywords.join(" · ")}`);

  console.log("\n✅ Cliente dado de alta. Entra con su email/contraseña en el panel y verá SU ficha.");
})().catch((e) => { console.error("\n❌", e.message); process.exit(1); });
