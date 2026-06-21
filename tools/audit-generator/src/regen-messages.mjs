// regen-messages.mjs — rehace mensajes de WhatsApp + emails desde el resumen YA
// generado (sin volver a llamar a la API). Uso: node src/regen-messages.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./config.mjs";
import { buildWhatsApp, buildEmail } from "./lib/message.mjs";
import { today } from "./lib/slug.mjs";

const dir = resolve(ROOT, "audits");
const sums = JSON.parse(
  readFileSync(resolve(dir, `_batch-summary-${today()}.json`), "utf8")
);
let briefs = [];
try {
  briefs = JSON.parse(
    readFileSync(resolve(ROOT, "examples/shortlist-pamplona.json"), "utf8")
  );
} catch {}

const rows = sums
  .map((s, i) => {
    if (s.error) return null;
    s.searchHint = briefs[i]?.searches?.[0] || null;
    s.wa = buildWhatsApp(s);
    s.email = buildEmail(s);
    const waNum = s.phone ? s.phone.replace(/[^\d]/g, "") : null;
    s.waLink = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(s.wa)}` : null;
    return s;
  })
  .filter(Boolean);

// --- WhatsApp (valor primero: mensaje + PDF a la vez) ---
const waMd = rows
  .map((s, i) => {
    const link = s.waLink
      ? `**[▶ Abrir WhatsApp con el mensaje listo](${s.waLink})**`
      : "_sin teléfono → usar email_";
    const pdf = s.file.replace(/\.html$/i, ".pdf");
    return `### ${i + 1}. ${s.name}\n${link}  ·  Tel: ${s.phone || "—"}  ·  PDF: \`${pdf}\`\n\n> ${s.wa}`;
  })
  .join("\n\n---\n\n");
writeFileSync(
  resolve(dir, `_whatsapp-envios-${today()}.md`),
  `# Envíos WhatsApp (valor primero) — ${today()}\n\n` +
    `> **1.** Clica el link → WhatsApp abre con el mensaje. **2.** Envía el mensaje y **adjunta el PDF justo después** (👇). **3.** Si responden con interés → llamada/visita (\`guion-venta.md\`).\n\n${waMd}\n`,
  "utf8"
);

// --- Emails (para el motor automático) ---
const emMd = rows
  .map((s, i) => {
    const pdf = s.file.replace(/\.html$/i, ".pdf");
    return `### ${i + 1}. ${s.name}  ·  adjuntar \`${pdf}\`\n**Asunto:** ${s.email.subject}\n\n${s.email.body}`;
  })
  .join("\n\n---\n\n");
writeFileSync(
  resolve(dir, `_emails-${today()}.md`),
  `# Emails de outreach (valor primero) — ${today()}\n\n> Para el motor automático. Adjuntar el PDF del audit. Falta el email del negocio (DataForSEO no lo da → scrape con Apify).\n\n${emMd}\n`,
  "utf8"
);

console.log(`Regenerados ${rows.length} WhatsApp + ${rows.length} emails.`);
