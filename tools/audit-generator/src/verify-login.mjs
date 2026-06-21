// verify-login.mjs — simula EXACTAMENTE lo que hace el navegador:
// login con el ANON key + lectura bajo RLS. Prueba que el usuario ve su negocio.
//   node src/verify-login.mjs [email] [password]   (necesita red)

import "./config.mjs"; // carga ~/.faro/.env (prioritario) o el .env del repo → process.env
const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const EMAIL = (process.argv[2] || "jordiborrutburgal@gmail.com").trim();
const PASSWORD = process.argv[3] || "FaroPanel2026";

(async () => {
  // 1) login con anon key
  const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const aj = await auth.json();
  if (!auth.ok) { console.error("❌ login:", auth.status, JSON.stringify(aj)); process.exit(1); }
  console.log(`✓ login OK como ${EMAIL}`);
  const token = aj.access_token;

  // 2) lecturas bajo RLS (igual que el SPA: apikey anon + Bearer token de usuario)
  const uh = { apikey: ANON, Authorization: `Bearer ${token}` };
  const get = async (q) => (await fetch(`${URL_}/rest/v1/${q}`, { headers: uh })).json();

  const clients = await get("clients?select=*");
  console.log(`✓ clients visibles bajo RLS: ${clients.length}  → ${clients.map((c) => c.name).join(", ")}`);
  if (!clients.length) { console.error("❌ RLS no devuelve el negocio (¿falta client_users?)"); process.exit(1); }
  const cid = clients[0].id;

  for (const t of ["snapshots", "rankings", "reviews", "competitors", "activity", "plan_items"]) {
    const rows = await get(`${t}?client_id=eq.${cid}&select=*`);
    console.log(`  ${t.padEnd(12)} ${Array.isArray(rows) ? rows.length : JSON.stringify(rows)}`);
  }
  const last = (await get(`snapshots?client_id=eq.${cid}&select=*&order=captured_at.desc&limit=1`))[0];
  console.log(`\nÚltimo snapshot (lo que verá de KPIs): vis ${last.visibility}/100 · ${last.reviews} reseñas · ${last.rating}★ · pos media ${last.avg_pos}º · ${last.est_calls} llamadas`);
  console.log("\n✅ El panel cargará datos reales al hacer login.");
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
