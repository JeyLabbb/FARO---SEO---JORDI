// brevo.mjs — envío de email vía Brevo REST API (api.brevo.com/v3). Adjunta el
// PDF del audit. Estado: ESCRITO, sin probar (falta BREVO_API_KEY en .env).
// ⚠️ Volumen: <50/día desde mtryx.com sin warm-up. Para escalar → dominios burner + Smartlead.
import { BRAND } from "../config.mjs";
import { readFileSync } from "node:fs";

const API_KEY = process.env.BREVO_API_KEY || "";
export const HAS_BREVO = Boolean(API_KEY);
const SENDER = {
  name: process.env.BREVO_SENDER_NAME || BRAND,
  email: process.env.BREVO_SENDER_EMAIL || "hola@mtryx.com",
};

/**
 * Envía un email con adjunto opcional.
 * @param {{to:string, subject:string, text?:string, html?:string, pdfPath?:string, pdfName?:string, replyTo?:string}} opts
 */
export async function sendEmail(opts) {
  if (!HAS_BREVO) throw new Error("Falta BREVO_API_KEY en .env");
  const html =
    opts.html ||
    `<div style="font-family:system-ui,Arial,sans-serif;white-space:pre-wrap;font-size:15px;color:#1b1c18">${(opts.text || "")
      .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`;
  const body = {
    sender: SENDER,
    to: [{ email: opts.to }],
    subject: opts.subject,
    htmlContent: html,
    ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
  };
  if (opts.pdfPath) {
    body.attachment = [
      { content: readFileSync(opts.pdfPath).toString("base64"), name: opts.pdfName || "audit.pdf" },
    ];
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": API_KEY, accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${data.message || res.statusText}`);
  return data; // { messageId }
}

/** Envía una tanda con throttling (respeta límites/deliverability). */
export async function sendBatch(items, { perMinute = 20, onSent } = {}) {
  const gap = Math.ceil(60000 / perMinute);
  const sent = [];
  for (const it of items) {
    try {
      const r = await sendEmail(it);
      sent.push({ to: it.to, ok: true, messageId: r.messageId });
    } catch (e) {
      sent.push({ to: it.to, ok: false, error: e.message });
    }
    if (onSent) onSent(sent[sent.length - 1]);
    await new Promise((r) => setTimeout(r, gap));
  }
  return sent;
}
