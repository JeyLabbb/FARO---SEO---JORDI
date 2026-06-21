// lib/panel.mjs — núcleo del panel multi-cliente.
// Mide un negocio con buildAudit (datos REALES de Google/DataForSEO) y lo
// escribe en Supabase: snapshot (histórico) + rankings + competidores + reseñas.
// Lo usan panel-snapshot.mjs (robot semanal) y panel-add-client.mjs (alta).
//
// Escribe con la SERVICE KEY (salta RLS). NECESITA RED → dangerouslyDisableSandbox.

import "../config.mjs"; // carga ~/.faro/.env (prioritario) o el .env del repo → process.env
import { buildAudit } from "./audit.mjs";

const URL_ = process.env.SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !SERVICE) throw new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY (revisa ~/.faro/.env)");

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

export async function rest(method, path, { body, prefer } = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

export const today = () => new Date().toISOString().slice(0, 10);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ── clientes ──────────────────────────────────────────────────────────────────
export async function listActiveClients() {
  return rest("GET", "clients?active=eq.true&select=*&order=created_at");
}
export async function clientKeywords(cid) {
  const rows = await rest("GET", `rankings?client_id=eq.${cid}&select=keyword`);
  return [...new Set(rows.map((r) => r.keyword))];
}
export async function upsertClient(c) {
  const [row] = await rest("POST", "clients?on_conflict=slug", {
    prefer: "resolution=merge-duplicates,return=representation",
    body: [c],
  });
  return row;
}

// ── usuario de login (Auth Admin API) ────────────────────────────────────────
export async function ensureUser(email, password) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST", headers: H,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (r.ok) return (await r.json()).id;
  const body = await r.text();
  if (r.status === 422 || /exist|registered/i.test(body)) {
    const list = await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: H }).then((x) => x.json());
    const users = Array.isArray(list) ? list : list.users || [];
    const found = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (!found) throw new Error("usuario existe pero no aparece en la lista admin");
    if (password) await fetch(`${URL_}/auth/v1/admin/users/${found.id}`, {
      method: "PUT", headers: H, body: JSON.stringify({ password, email_confirm: true }),
    });
    return found.id;
  }
  throw new Error(`crear usuario → ${r.status} ${body}`);
}
export async function linkUser(clientId, userId, role = "owner") {
  await rest("POST", "client_users?on_conflict=client_id,user_id", {
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [{ client_id: clientId, user_id: userId, role }],
  });
}

// ── derivar métricas del audit (MISMAS fórmulas que client-dashboard.mjs) ─────
export function deriveMetrics(a) {
  const reviews = a.gbp.reviews || 0, rating = a.gbp.rating || 0;
  const posByQ = a.positions.map((p) => ({ q: p.query, pos: p.business }));
  const known = posByQ.map((x) => x.pos).filter((n) => n != null);
  const avgPos = known.length ? Math.round(known.reduce((x, y) => x + y, 0) / known.length) : 12;
  const leader = a.bestCompetitor;
  const posScore = clamp(105 - avgPos * 7, 5, 100);
  const revScore = leader && leader.reviews ? clamp((reviews / leader.reviews) * 100, 5, 100) : 50;
  const webScore = a.web.url ? (a.web.hasLocalBusinessSchema ? 80 : 45) : 20;
  const vis = Math.round(posScore * 0.4 + revScore * 0.35 + webScore * 0.25);
  const baseCalls = Math.round(reviews * 1.6 + (12 - Math.min(avgPos, 11)) * 8);
  return {
    vis, reviews, rating, avgPos, posByQ,
    est_calls: baseCalls,
    est_clicks: Math.round(baseCalls * 6.2),
    est_views: Math.round(baseCalls * 24),
    est_routes: Math.round(baseCalls * 2.1),
    competitors: (a.competitors || []).slice(0, 3).map((c) => ({ name: c.name, reviews: c.reviews || 0, rating: c.rating ?? null })),
    recent: (a.gbp.reviewsSample || []).slice(0, 4).map((r) => ({ author: r.author, rating: r.rating, body: (r.text || "").slice(0, 300), review_when: r.when })),
  };
}

// ── medir un cliente y escribir su ficha (snapshot + rankings + comp + reseñas) ─
export async function snapshotClient(client, keywords) {
  const a = await buildAudit({
    name: client.name,
    city: client.city || "Pamplona",
    placeId: client.google_place_id || undefined,
    website: client.website || undefined,
    searches: (keywords || []).slice(0, 3),
  }, { skipSpeed: true });

  const m = deriveMetrics(a);
  const cid = client.id, d = today();

  // snapshot (upsert por client_id+captured_at → re-medir el mismo día actualiza)
  await rest("POST", "snapshots?on_conflict=client_id,captured_at", {
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [{
      client_id: cid, captured_at: d,
      visibility: m.vis, reviews: m.reviews, rating: m.rating, avg_pos: m.avgPos,
      est_calls: m.est_calls, est_clicks: m.est_clicks, est_views: m.est_views, est_routes: m.est_routes,
    }],
  });

  // rankings de hoy (reemplaza los de hoy; conserva el histórico de días previos)
  await rest("DELETE", `rankings?client_id=eq.${cid}&captured_at=eq.${d}`, { prefer: "return=minimal" });
  if (m.posByQ.length) await rest("POST", "rankings", {
    prefer: "return=minimal",
    body: m.posByQ.map((p) => ({ client_id: cid, captured_at: d, keyword: p.q, position: p.pos })),
  });

  // competidores y reseñas = estado actual → se reemplazan
  await rest("DELETE", `competitors?client_id=eq.${cid}`, { prefer: "return=minimal" });
  if (m.competitors.length) await rest("POST", "competitors", { prefer: "return=minimal", body: m.competitors.map((c) => ({ ...c, client_id: cid })) });
  await rest("DELETE", `reviews?client_id=eq.${cid}`, { prefer: "return=minimal" });
  if (m.recent.length) await rest("POST", "reviews", { prefer: "return=minimal", body: m.recent.map((r) => ({ ...r, client_id: cid })) });

  // backfill del place_id de Google si no lo teníamos (emparejado exacto)
  if (!client.google_place_id && a.business?.id) {
    await rest("PATCH", `clients?id=eq.${cid}`, { prefer: "return=minimal", body: { google_place_id: a.business.id } });
  }

  return { vis: m.vis, avgPos: m.avgPos, reviews: m.reviews, rating: m.rating, placeId: a.business?.id || null, mapPackReal: a.mapPackReal, keywords: m.posByQ.map((p) => `${p.q}=${p.pos ?? "—"}`) };
}
