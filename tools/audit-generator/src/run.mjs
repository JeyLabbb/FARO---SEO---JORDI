#!/usr/bin/env node
// run.mjs — pipeline TODO-EN-UNO. Un solo comando:
//   resuelve ficha → audita → PDF → busca email → mensajes (WhatsApp + email) → tracker.
// Uso: node src/run.mjs examples/shortlist-pamplona.json [--fast]
//   --fast  omite PageSpeed (mucho más rápido para lotes grandes; sección velocidad queda vacía).
//
// Cada lote escribe con la etiqueta del fichero de briefs, así no se pisan:
//   _whatsapp-<label>-FECHA.md · _emails-<label>-FECHA.md · outreach-tracker-<label>-FECHA.csv
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, isAbsolute } from "node:path";
import { ROOT, HAS_API_KEY } from "./config.mjs";
import { buildAudit } from "./lib/audit.mjs";
import { renderMarkdown, renderHtml } from "./lib/render.mjs";
import { buildWhatsApp, buildEmail, waLink } from "./lib/message.mjs";
import { findEmails } from "./lib/findemail.mjs";
import { slugify, today } from "./lib/slug.mjs";

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const BROWSER = BROWSERS.find((p) => existsSync(p));

function htmlToPdf(htmlPath) {
  if (!BROWSER) return null;
  const out = htmlPath.replace(/\.html$/i, ".pdf");
  try {
    execFileSync(
      BROWSER,
      [
        "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw", "--virtual-time-budget=6000",
        `--user-data-dir=${resolve(ROOT, ".pdf-profile")}`,
        `--print-to-pdf=${out}`,
        `file:///${htmlPath.replace(/\\/g, "/")}`,
      ],
      { stdio: "ignore", timeout: 90000 }
    );
    return out;
  } catch {
    return null;
  }
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function main() {
  const args = process.argv.slice(2);
  const fast = args.includes("--fast");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) return console.error("Uso: node src/run.mjs <briefs.json> [--fast]");
  if (!HAS_API_KEY) return console.error("Falta GOOGLE_MAPS_API_KEY en .env");
  const label = (file.split(/[\\/]/).pop() || "run").replace(/\.json$/i, "");
  const briefs = JSON.parse(readFileSync(isAbsolute(file) ? file : resolve(process.cwd(), file), "utf8"));
  const outDir = resolve(ROOT, "audits");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  process.stdout.write(`\nPipeline "${label}" sobre ${briefs.length} negocios${fast ? " (rápido)" : ""}. PDF: ${BROWSER ? "sí" : "NO"}\n`);

  const rows = [];
  for (const brief of briefs) {
    process.stdout.write(`\n▶ ${brief.name}\n`);
    try {
      const a = await buildAudit(brief, { skipSpeed: fast });
      const base = `${slugify(a.business.name)}-${today()}`;
      writeFileSync(resolve(outDir, base + ".md"), renderMarkdown(a), "utf8");
      writeFileSync(resolve(outDir, base + ".html"), renderHtml(a), "utf8");
      const pdf = htmlToPdf(resolve(outDir, base + ".html"));

      const phone =
        a.business.detail?.internationalPhoneNumber ||
        a.business.detail?.nationalPhoneNumber || null;
      let email = null;
      if (a.web.url) { try { email = (await findEmails(a.web.url)).best; } catch {} }

      const bizPos = a.positions.map((p) => p.business).filter((n) => n != null);
      const avg = bizPos.length ? Math.round(bizPos.reduce((x, y) => x + y, 0) / bizPos.length) : null;
      const s = {
        name: a.business.name, searchHint: brief.searches?.[0] || null,
        avgPos: avg, reviews: a.gbp.reviews, rating: a.gbp.rating,
        leaderReviews: a.bestCompetitor?.reviews ?? null,
        hasWeb: Boolean(a.web.url), hasHours: a.gbp.hasHours, speed: a.speed.score,
        phone, email, website: a.web.url || null,
        pdf: pdf ? base + ".pdf" : null, file: base + ".html",
      };
      s.wa = buildWhatsApp(s);
      s.email_msg = buildEmail(s);
      s.waLink = waLink(phone, s.wa);
      rows.push(s);
      process.stdout.write(
        `  ✓ pos≈${avg ?? "—"} · ${s.reviews} reseñas · tel:${phone ? "sí" : "—"} · email:${email || "—"} · pdf:${pdf ? "sí" : "NO"}\n`
      );
    } catch (e) {
      process.stdout.write(`  ✗ ${e.message}\n`);
      rows.push({ name: brief.name, error: e.message });
    }
  }

  const ok = rows.filter((r) => !r.error);
  writeFileSync(
    resolve(outDir, `_whatsapp-${label}-${today()}.md`),
    `# Envíos WhatsApp (valor primero) — ${label} — ${today()}\n\n> 1) Clica el link → envía el mensaje. 2) Adjunta el PDF justo después. 3) Si hay interés → llamada (guion-venta.md).\n\n` +
      ok.map((s, i) => {
        const link = s.waLink ? `**[▶ WhatsApp](${s.waLink})**` : "_sin tel → email_";
        return `### ${i + 1}. ${s.name}\n${link} · Tel: ${s.phone || "—"} · PDF: \`${s.pdf || "—"}\`\n\n> ${s.wa}`;
      }).join("\n\n---\n\n") + "\n",
    "utf8"
  );
  writeFileSync(
    resolve(outDir, `_emails-${label}-${today()}.md`),
    `# Emails de outreach — ${label} — ${today()}\n\n> Adjuntar el PDF. Destino entre [corchetes] (vacío = scrapear con Apify / a mano).\n\n` +
      ok.map((s, i) => `### ${i + 1}. ${s.name} → [${s.email || "SIN EMAIL"}] · adjuntar \`${s.pdf || "—"}\`\n**Asunto:** ${s.email_msg.subject}\n\n${s.email_msg.body}`).join("\n\n---\n\n") + "\n",
    "utf8"
  );
  const headers = ["negocio","busqueda","telefono","email","website","pos_aprox","resenas","lider_resenas","tiene_web","velocidad","pdf","wa_link","estado"];
  const csv = [headers.join(",")].concat(
    ok.map((s) => [s.name, s.searchHint, s.phone, s.email, s.website, s.avgPos, s.reviews, s.leaderReviews, s.hasWeb, s.speed, s.pdf, s.waLink, "pendiente"].map(csvCell).join(","))
  ).join("\n");
  writeFileSync(resolve(outDir, `outreach-tracker-${label}-${today()}.csv`), csv, "utf8");
  writeFileSync(resolve(outDir, `_run-summary-${label}-${today()}.json`), JSON.stringify(rows, null, 2), "utf8");

  const withEmail = ok.filter((s) => s.email).length;
  const withPhone = ok.filter((s) => s.phone).length;
  process.stdout.write(
    `\n══ ${ok.length}/${briefs.length} OK · ${withPhone} con teléfono · ${withEmail} con email ══\n` +
      `Tracker: outreach-tracker-${label}-${today()}.csv\n`
  );
}

main().catch((e) => { console.error("\nError:", e.message); process.exit(1); });
