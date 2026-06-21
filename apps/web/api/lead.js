// api/lead.js — recibe el formulario de "análisis gratis" de la landing y te
// avisa por email (vía Brevo) de cada lead nuevo. Función serverless de Vercel.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    if (!b || typeof b !== "object") b = {};
    const clean = (v, n) => String(v || "").slice(0, n).trim();
    const nombre = clean(b.nombre, 120);
    const negocio = clean(b.negocio, 120);
    const ciudad = clean(b.ciudad, 80);
    const sector = clean(b.sector, 40);
    const web = clean(b.web, 160);
    const contacto = clean(b.contacto, 160);
    const mensaje = clean(b.mensaje, 800);
    if (!nombre || !negocio || !contacto) { res.status(400).json({ error: "faltan datos" }); return; }

    const KEY = process.env.BREVO_API_KEY;
    const TO = process.env.LEAD_EMAIL || "yourbusinesstry@gmail.com";
    const FROM = process.env.BREVO_SENDER_EMAIL || "hola@mtryx.com";
    if (!KEY) { console.error("lead: falta BREVO_API_KEY"); res.status(200).json({ ok: true, note: "sin email" }); return; }

    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: FROM, name: "Faro · Landing" },
        to: [{ email: TO }],
        subject: `🔔 Nuevo lead: ${negocio}${ciudad ? " (" + ciudad + ")" : ""}`,
        htmlContent: `<h2>Nuevo análisis solicitado desde la web</h2>
          <p><b>Negocio:</b> ${negocio}</p>
          <p><b>Nombre:</b> ${nombre}</p>
          <p><b>Ciudad:</b> ${ciudad || "—"}</p>
          <p><b>Sector:</b> ${sector || "—"}</p>
          <p><b>Web:</b> ${web || "—"}</p>
          <p><b>Contacto:</b> ${contacto}</p>
          ${mensaje ? `<p><b>Mensaje:</b> ${mensaje}</p>` : ""}
          <hr><p style="color:#888">Responde en el mismo día: hazle el audit y pásaselo.</p>`,
      }),
    });
    if (!r.ok) console.error("lead: brevo", r.status, (await r.text()).slice(0, 200));
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("lead handler", e);
    res.status(200).json({ ok: true });
  }
};
