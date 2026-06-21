// api/chat.js — backend del asistente del panel (Vercel Serverless Function).
// Coge los datos REALES del cliente logueado (Supabase, bajo RLS con su token)
// y responde con OpenAI gpt-4o-mini, en cristiano y con honestidad.
//
// Seguridad: exige un token de sesión válido (solo clientes logueados) → nadie
// anónimo puede gastar tus créditos. La clave de OpenAI vive en Vercel (env),
// nunca en el navegador.

const SUPABASE_URL = "https://bhchtxcpjwuybiopnlth.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoY2h0eGNwand1eWJpb3BubHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODMwMTIsImV4cCI6MjA5NjE1OTAxMn0.3fTVaKQPMVTZeRKMXQSVXlu0efkWMChZT82FqTYi5UI";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  const OPENAI = process.env.OPENAI_API_KEY;
  if (!OPENAI) { res.status(200).json({ answer: "El asistente aún no está activado. Avisa al equipo de Faro." }); return; }

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};
    const token = body.token;
    const question = String(body.question || "").slice(0, 500).trim();
    if (!token || !question) { res.status(400).json({ error: "faltan token o pregunta" }); return; }

    const uh = { apikey: ANON, Authorization: `Bearer ${token}` };

    // 1) validar sesión
    const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: uh });
    if (!ures.ok) { res.status(401).json({ error: "sesión no válida" }); return; }

    // 2) datos del cliente (RLS con su propio token → solo ve lo suyo)
    const get = async (q) => { try { const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: uh }); return r.ok ? await r.json() : []; } catch { return []; } };
    const clients = await get("clients?select=*&limit=1");
    const c = Array.isArray(clients) && clients[0];
    if (!c) { res.status(200).json({ answer: "Aún no veo tu ficha cargada. Dile al equipo de Faro que la active y te responderé con tus datos. 🙂" }); return; }
    const cid = c.id;
    const [snaps, comps, plan, acts] = await Promise.all([
      get(`snapshots?client_id=eq.${cid}&select=*&order=captured_at.desc&limit=1`),
      get(`competitors?client_id=eq.${cid}&select=name,reviews,rating&order=reviews.desc&limit=4`),
      get(`plan_items?client_id=eq.${cid}&select=title,done&order=sort`),
      get(`activity?client_id=eq.${cid}&select=kind,body&order=happened_at.desc&limit=5`),
    ]);
    const s = (Array.isArray(snaps) && snaps[0]) || {};
    const fmtComp = (Array.isArray(comps) ? comps : []).map((x) => `${x.name} (${x.reviews} reseñas)`).join("; ") || "—";
    const fmtPlan = (Array.isArray(plan) ? plan : []).map((p) => `${p.done ? "[hecho]" : "[pendiente]"} ${p.title}`).join("; ") || "—";
    const fmtAct = (Array.isArray(acts) ? acts : []).map((a) => a.body).join("; ") || "—";

    // 3) prompt (español, sin tecnicismos, honesto, nada de "nº1")
    const sys = [
      `Eres el asistente virtual de Faro, un servicio de SEO local (posicionar negocios en Google Maps / Map Pack). Atiendes al negocio "${c.name}"${c.city ? ` en ${c.city}` : ""}.`,
      `Habla en español de España, cercano, claro y SIN tecnicismos (tu interlocutor es el dueño del negocio, no un técnico). Respuestas breves: 2-5 frases. Algún emoji con moderación.`,
      `Usa SOLO los datos reales de abajo. Si preguntan algo que no está en los datos, dilo con naturalidad y ofrece que lo revise el equipo de Faro. NUNCA prometas el puesto número 1 ni resultados garantizados: promete trabajo y mejoras concretas, con honestidad.`,
      ``,
      `DATOS ACTUALES DE "${c.name}":`,
      `- Índice de visibilidad: ${s.visibility != null ? s.visibility + "/100" : "s/d"}`,
      `- Posición media en el Map Pack: ${s.avg_pos != null ? s.avg_pos + "º" : "s/d"}`,
      `- Reseñas en Google: ${s.reviews != null ? s.reviews : "s/d"}${s.rating ? ` (${s.rating}★ de media)` : ""}`,
      `- Estimación mensual — llamadas: ${s.est_calls ?? "s/d"}, clics a la ficha: ${s.est_clicks ?? "s/d"}, veces que aparece: ${s.est_views ?? "s/d"}`,
      `- Competidores de su zona: ${fmtComp}`,
      `- Plan de trabajo de Faro: ${fmtPlan}`,
      `- Trabajo reciente de Faro en su ficha: ${fmtAct}`,
    ].join("\n");

    // 4) OpenAI (gpt-4o-mini, respuesta acotada → coste mínimo)
    const oai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 400,
        temperature: 0.4,
        messages: [{ role: "system", content: sys }, { role: "user", content: question }],
      }),
    });
    if (!oai.ok) {
      console.error("OpenAI error", oai.status, (await oai.text()).slice(0, 300));
      res.status(200).json({ answer: "Ahora mismo no puedo responder con la IA (puede estar saturada o sin saldo). Inténtalo en un momento o pregúntale al equipo de Faro." });
      return;
    }
    const data = await oai.json();
    const answer = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    res.status(200).json({ answer: answer || "No he sabido responder a eso, ¿puedes reformularlo?" });
  } catch (e) {
    console.error("chat handler", e);
    res.status(200).json({ answer: "Uy, algo ha fallado por mi lado. Prueba otra vez en un momento. 🙏" });
  }
};
