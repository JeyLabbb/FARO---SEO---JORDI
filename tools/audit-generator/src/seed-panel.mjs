// seed-panel.mjs — siembra el panel de cliente (Supabase) con un negocio demo
// de Pamplona (Pagadi Studio de pilates) + un usuario de login.
//
// Idempotente: re-ejecutar no duplica (upsert de client/client_users, y
// delete+insert de las tablas hijas). Escribe con la SERVICE KEY (salta RLS).
//
//   node src/seed-panel.mjs [email] [password]
//
// NECESITA RED → ejecutar con dangerouslyDisableSandbox.

import "./config.mjs"; // carga ~/.faro/.env (prioritario) o el .env del repo → process.env
const URL_ = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !SERVICE) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY (revisa ~/.faro/.env)");
  process.exit(1);
}

const EMAIL = (process.argv[2] || "jordiborrutburgal@gmail.com").trim();
const PASSWORD = process.argv[3] || "FaroPanel2026";

// ── helpers HTTP ─────────────────────────────────────────────────────────────
const H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};
async function rest(method, path, { body, prefer } = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

// ── 1) usuario de login (Auth Admin API) ─────────────────────────────────────
async function ensureUser() {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (r.ok) {
    const u = await r.json();
    console.log(`  ✓ usuario creado: ${EMAIL}`);
    return u.id;
  }
  // ya existe → buscarlo en la lista de admin
  const body = await r.text();
  if (r.status === 422 || /exist|registered/i.test(body)) {
    const list = await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: H }).then((x) => x.json());
    const users = Array.isArray(list) ? list : list.users || [];
    const found = users.find((u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase());
    if (!found) throw new Error("usuario existe pero no lo encuentro en la lista admin");
    // resetear la contraseña al valor conocido (por si la habíamos cambiado)
    await fetch(`${URL_}/auth/v1/admin/users/${found.id}`, {
      method: "PUT", headers: H, body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
    });
    console.log(`  ✓ usuario ya existía, contraseña sincronizada: ${EMAIL}`);
    return found.id;
  }
  throw new Error(`crear usuario → ${r.status} ${body}`);
}

// ── 2) datos del negocio demo (Pagadi, Pamplona — datos reales del SPA) ───────
const MONTHS = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];
const SNAP = {
  visibility: [20, 23, 25, 29, 32, 33],
  reviews:    [7,  9,  9,  11, 13, 13],
  rating:     [5,  5,  5,  5,  5,  5],
  avg_pos:    [14, 13, 12, 10, 9,  8],
  est_calls:  [29, 33, 38, 46, 51, 53],
  est_clicks: [181, 209, 234, 284, 319, 329],
  est_views:  [763, 863, 945, 1121, 1238, 1272],
  est_routes: [64, 74, 82, 97, 107, 111],
};
const RANKINGS = {
  "pilates Pamplona": [16, 15, 14, 12, 9, 8],
  "pilates cerca de mí": [36, 34, 31, 26, 21, 18],
  "clases de pilates Pamplona": [16, 15, 14, 12, 9, 8],
};
const REVIEWS = [
  { author: "María Muñoa", rating: 5, review_when: "6 months ago", body: "I had no prior experience with Pilates and I'm very happy. Klaudia leads the class, explains the exercises clearly, and makes corrections when necessary." },
  { author: "Angela Grandival Garcia", rating: 5, review_when: "7 months ago", body: "I had no prior Pilates experience, but Klaudia makes it easy. She motivates her students in every exercise and corrects their posture." },
  { author: "Adriana Urmeneta", rating: 5, review_when: "6 months ago", body: "Great place and, above all, a great teacher. Klaudia takes excellent care of all of us, teaching with patience and joy. She adapts each class to your level." },
  { author: "Arantxa San Agustin", rating: 5, review_when: "5 months ago", body: "I loved it! I've already noticed an improvement after just one class. Klaudia explains things brilliantly and makes sure everyone has good posture." },
];
const COMPETITORS = [
  { name: "Gimnasio Sparta Sport Center Pamplona - Calle Estella", reviews: 225, rating: 4.7 },
  { name: "Amore Pilates Studio", reviews: 52, rating: 4.9 },
  { name: "Pilates Pamplona - Studio o2 Pilates", reviews: 49, rating: 4.9 },
];
const ACTIVITY = [
  { happened_at: "2026-06-04T10:00:00Z", kind: "reseñas", body: "Pedidas reseñas a 9 clientes por WhatsApp" },
  { happened_at: "2026-06-03T16:00:00Z", kind: "post",    body: "Publicado post: «Nuevas clases de suelo pélvico»" },
  { happened_at: "2026-06-01T11:00:00Z", kind: "reseñas", body: "Respondidas 6 reseñas" },
  { happened_at: "2026-05-30T12:00:00Z", kind: "fotos",   body: "Subidas 8 fotos nuevas a la ficha" },
  { happened_at: "2026-05-28T09:00:00Z", kind: "web",     body: "Añadido schema LocalBusiness a tu web" },
  { happened_at: "2026-05-27T15:00:00Z", kind: "ficha",   body: "Corregida categoría principal y horario" },
  { happened_at: "2026-05-21T13:00:00Z", kind: "ficha",   body: "Optimizada descripción con keywords locales" },
];
const PLAN = [
  { title: "Configurar el horario en la ficha (incl. festivos)", done: true, sort: 0 },
  { title: "Arrancar una campaña de reseñas", done: false, sort: 1 },
  { title: "Meter keyword local en el title y el H1 de la web", done: false, sort: 2 },
  { title: "Optimización continua de la ficha", done: false, sort: 3 },
];

// ── run ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Sembrando panel en ${URL_}\n`);
  const userId = await ensureUser();

  // cliente (upsert por slug)
  const [client] = await rest("POST", "clients?on_conflict=slug", {
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      slug: "pagadi",
      name: "Pagadi Studio de pilates",
      city: "Pamplona",
      website: "https://pagadi-studio.trainin.app/signup",
      brand: "Faro",
      active: true,
    }],
  });
  const cid = client.id;
  console.log(`  ✓ cliente: ${client.name} (${cid})`);

  // puente usuario↔negocio
  await rest("POST", "client_users?on_conflict=client_id,user_id", {
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [{ client_id: cid, user_id: userId, role: "owner" }],
  });
  console.log(`  ✓ acceso vinculado (client_users)`);

  // hijos: borrar lo del cliente y reinsertar (idempotente)
  const children = ["snapshots", "rankings", "reviews", "competitors", "activity", "plan_items"];
  for (const t of children) await rest("DELETE", `${t}?client_id=eq.${cid}`, { prefer: "return=minimal" });

  const snapshots = MONTHS.map((d, i) => ({
    client_id: cid, captured_at: d,
    visibility: SNAP.visibility[i], reviews: SNAP.reviews[i], rating: SNAP.rating[i], avg_pos: SNAP.avg_pos[i],
    est_calls: SNAP.est_calls[i], est_clicks: SNAP.est_clicks[i], est_views: SNAP.est_views[i], est_routes: SNAP.est_routes[i],
  }));
  const rankings = Object.entries(RANKINGS).flatMap(([keyword, pos]) =>
    MONTHS.map((d, i) => ({ client_id: cid, captured_at: d, keyword, position: pos[i] })));

  await rest("POST", "snapshots",   { prefer: "return=minimal", body: snapshots });
  await rest("POST", "rankings",    { prefer: "return=minimal", body: rankings });
  await rest("POST", "reviews",     { prefer: "return=minimal", body: REVIEWS.map((r) => ({ ...r, client_id: cid })) });
  await rest("POST", "competitors", { prefer: "return=minimal", body: COMPETITORS.map((c) => ({ ...c, client_id: cid })) });
  await rest("POST", "activity",    { prefer: "return=minimal", body: ACTIVITY.map((a) => ({ ...a, client_id: cid })) });
  await rest("POST", "plan_items",  { prefer: "return=minimal", body: PLAN.map((p) => ({ ...p, client_id: cid })) });

  // verificar
  console.log("\nVerificación (filas por tabla):");
  for (const t of children) {
    const rows = await rest("GET", `${t}?client_id=eq.${cid}&select=*`);
    console.log(`  ${t.padEnd(12)} ${rows.length}`);
  }

  console.log("\n✅ Seed completo.");
  console.log("   ─────────────────────────────────────────");
  console.log(`   Login:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Negocio:  Pagadi Studio de pilates · Pamplona`);
  console.log("   ─────────────────────────────────────────");
})().catch((e) => { console.error("\n❌", e.message); process.exit(1); });
