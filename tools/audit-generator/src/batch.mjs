#!/usr/bin/env node
// batch.mjs — genera audits para una lista de briefs (JSON array) de una tacada.
// Uso: node src/batch.mjs examples/shortlist-pamplona.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { ROOT, HAS_API_KEY } from "./config.mjs";
import { buildAudit } from "./lib/audit.mjs";
import { renderMarkdown, renderHtml } from "./lib/render.mjs";
import { buildMessage } from "./lib/message.mjs";
import { slugify, today } from "./lib/slug.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node src/batch.mjs <briefs.json>");
  process.exit(1);
}
if (!HAS_API_KEY) {
  console.error("Falta GOOGLE_MAPS_API_KEY en .env.");
  process.exit(1);
}

const briefs = JSON.parse(
  readFileSync(isAbsolute(file) ? file : resolve(process.cwd(), file), "utf8")
);
const outDir = resolve(ROOT, "audits");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const summaries = [];
for (const brief of briefs) {
  process.stdout.write(`\n▶ ${brief.name}...\n`);
  try {
    const a = await buildAudit(brief);
    const base = `${slugify(a.business.name)}-${today()}`;
    writeFileSync(resolve(outDir, base + ".md"), renderMarkdown(a), "utf8");
    writeFileSync(resolve(outDir, base + ".html"), renderHtml(a), "utf8");

    const bizPos = a.positions.map((p) => p.business).filter((n) => n != null);
    const avg = bizPos.length
      ? Math.round(bizPos.reduce((x, y) => x + y, 0) / bizPos.length)
      : null;
    const s = {
      name: a.business.name,
      avgPos: avg,
      reviews: a.gbp.reviews,
      rating: a.gbp.rating,
      lastReview: a.gbp.lastReviewWhen,
      leader: a.bestCompetitor?.name || null,
      leaderReviews: a.bestCompetitor?.reviews ?? null,
      hasWeb: Boolean(a.web.url),
      speed: a.speed.score,
      hasHours: a.gbp.hasHours,
      category: a.gbp.category,
      topWin: a.quickWins[0]?.title || null,
      win2: a.quickWins[1]?.title || null,
      searchHint: brief.searches?.[0] || null,
      phone:
        a.business.detail?.internationalPhoneNumber ||
        a.business.detail?.nationalPhoneNumber ||
        null,
      file: base + ".html",
    };
    s.message = buildMessage(s);
    const waNum = s.phone ? s.phone.replace(/[^\d]/g, "") : null;
    s.waLink = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(s.message)}` : null;
    writeFileSync(resolve(outDir, base + ".msg.txt"), s.message, "utf8");
    summaries.push(s);
    process.stdout.write(
      `  ✓ pos≈${avg} · ${s.reviews} reseñas (líder ${s.leaderReviews}) · ` +
        `web:${s.hasWeb ? "sí" : "NO"} · vel:${s.speed ?? "—"} · win: ${s.topWin}\n`
    );
  } catch (e) {
    process.stdout.write(`  ✗ ${brief.name}: ${e.message}\n`);
    summaries.push({ name: brief.name, error: e.message });
  }
}

writeFileSync(
  resolve(outDir, `_batch-summary-${today()}.json`),
  JSON.stringify(summaries, null, 2),
  "utf8"
);
// Archivo único con todos los mensajes listos para copiar/pegar.
const msgMd = summaries
  .filter((s) => !s.error)
  .map((s, i) => `## ${i + 1}. ${s.name}\n\n${s.message}\n`)
  .join("\n---\n\n");
writeFileSync(
  resolve(outDir, `_mensajes-${today()}.md`),
  `# Mensajes de outreach (auto) — ${today()}\n\n> Personaliza el nombre y envía de uno en uno (no en masa).\n\n${msgMd}`,
  "utf8"
);
// Cola de envío por WhatsApp: link que abre WhatsApp con el mensaje ya escrito.
const waMd = summaries
  .filter((s) => !s.error)
  .map((s, i) => {
    const link = s.waLink
      ? `**[▶ Abrir WhatsApp con el mensaje listo](${s.waLink})**`
      : "_sin teléfono → contactar por email/IG_";
    return `### ${i + 1}. ${s.name}\n${link}  ·  Tel: ${s.phone || "—"}  ·  Audit: \`${s.file}\`\n\n> ${s.message}`;
  })
  .join("\n\n---\n\n");
writeFileSync(
  resolve(outDir, `_whatsapp-envios-${today()}.md`),
  `# Envíos WhatsApp (rápido) — ${today()}\n\n> Clica el link → WhatsApp abre con el mensaje escrito. Adjunta el PDF del audit y envía. Si el negocio no tiene WhatsApp en ese número, usa email/IG.\n\n${waMd}\n`,
  "utf8"
);
const ok = summaries.filter((s) => !s.error).length;
process.stdout.write(`\n══ Hecho: ${ok}/${briefs.length} audits + mensajes + cola WhatsApp ══\n`);
