#!/usr/bin/env node
// rebuild-sends.mjs — reconstruye los archivos de envío desde los _run-summary-*.json
// (sin llamar a la API): mensajes + links de WhatsApp arreglados + UNA cola maestra
// priorizada (OUTREACH-QUEUE). Úsalo si cambian los mensajes o se rompió algún link.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./config.mjs";
import { buildWhatsApp, buildEmail, waLink } from "./lib/message.mjs";
import { today, normalize } from "./lib/slug.mjs";

const dir = resolve(ROOT, "audits");
const cell = (v) => String(v ?? "").replace(/\|/g, " "); // no romper la tabla MD

function priority(s) {
  let p = 0;
  if (!s.hasWeb) p += 3;
  if (s.leaderReviews && s.reviews < s.leaderReviews * 0.5) p += 2;
  if (s.rating != null && s.rating < 4.4) p += 2;
  if (s.avgPos != null && s.avgPos >= 8) p += 1;
  if (s.reviews < 15) p -= 2;
  if (s.reviews >= 30 && s.reviews <= 400) p += 1;
  return p;
}
function signal(s) {
  const out = [];
  if (!s.hasWeb) out.push("SIN WEB");
  if (s.leaderReviews && s.reviews < s.leaderReviews * 0.5) out.push(`${s.reviews} vs ${s.leaderReviews} reseñas`);
  if (s.rating != null && s.rating < 4.4) out.push(`nota ${s.rating}`);
  if (s.avgPos != null && s.avgPos >= 8) out.push(`pos ≈${s.avgPos}`);
  return out.join(" · ") || "ficha decente";
}

const files = readdirSync(dir).filter((f) => /^_run-summary-.*\.json$/.test(f));
const seen = new Set();
const all = [];
for (const f of files) {
  const label = f.replace(/^_run-summary-/, "").replace(/\.json$/, "");
  const arr = JSON.parse(readFileSync(resolve(dir, f), "utf8")).filter((s) => !s.error);
  for (const s of arr) {
    s.wa = buildWhatsApp(s);
    s.email_msg = s.email_msg || buildEmail(s);
    s.waLink = waLink(s.phone, s.wa);
  }
  writeFileSync(
    resolve(dir, `_whatsapp-${label}.md`),
    `# Envíos WhatsApp — ${label}\n\n> Clica el link → envía el mensaje → adjunta el PDF.\n\n` +
      arr.map((s, i) =>
        `### ${i + 1}. ${cell(s.name)}\n${s.waLink ? `**[▶ WhatsApp](${s.waLink})**` : "_sin teléfono_"} · Tel: ${s.phone || "—"} · PDF: \`${s.pdf || "—"}\`\n\n> ${s.wa}`
      ).join("\n\n---\n\n") + "\n",
    "utf8"
  );
  for (const s of arr) {
    const k = normalize(s.name);
    if (!seen.has(k)) { seen.add(k); all.push(s); }
  }
}

all.sort((a, b) => priority(b) - priority(a) || (b.reviews || 0) - (a.reviews || 0));
const queue = all
  .map((s, i) => {
    const chan = [];
    if (s.waLink) chan.push(`[WhatsApp](${s.waLink})`);
    if (s.email) chan.push(`✉️ ${s.email}`);
    return `| ${i + 1} | ${cell(s.name)} | ${cell(s.searchHint)} | ${cell(signal(s))} | ${chan.join(" · ") || "—"} | \`${s.pdf || "—"}\` |`;
  })
  .join("\n");

writeFileSync(
  resolve(dir, `OUTREACH-QUEUE-${today()}.md`),
  `# Cola de outreach — TODO en una lista (${today()})\n\n` +
    `> ${all.length} negocios, ordenados por prioridad (hueco gordo + negocio con tracción arriba).\n` +
    `> Ve de arriba a abajo: clica WhatsApp → envía → adjunta el PDF. Verifica la ficha/el email antes de enviar.\n\n` +
    `| # | Negocio | Búsqueda | Señal | Canal | PDF |\n|---|---|---|---|---|---|\n${queue}\n`,
  "utf8"
);
console.log(`Reconstruido: ${files.length} lotes · ${all.length} negocios → OUTREACH-QUEUE-${today()}.md`);
