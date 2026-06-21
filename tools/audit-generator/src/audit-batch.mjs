// audit-batch.mjs — LOTE diario "email-first con audit".
// Por cada negocio: saca su email (web) + genera SU análisis (buildAudit, datos
// reales) + lo aloja como página en apps/web/audits/<slug>.html + arma la lista
// para Mailmeteor con el enlace a su audit. Luego se redespliega la web.
//
//   node src/audit-batch.mjs [archivo.csv] [--top 12] [--skip 0]
//
// NECESITA RED → dangerouslyDisableSandbox.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT, BRAND } from "./config.mjs";
import { buildAudit } from "./lib/audit.mjs";
import { renderHtml } from "./lib/render.mjs";
import { findEmails } from "./lib/findemail.mjs";
import { slugify, today } from "./lib/slug.mjs";
import { projectFindings } from "./lib/email-copy.mjs";
import { personalize } from "./lib/personalize.mjs";
import { qaRow } from "./lib/qa.mjs";

const BUSCA = { dental: "dentista", estetica: "centro de estética", fisioterapia: "fisioterapia", pilates: "pilates", peluqueria: "peluquería" };

function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }
const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function mapLimit(items, limit, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } })); return out; }
// Reintenta ante fallos de red transitorios ("fetch failed", timeouts, reset) — hasta 3 intentos con espera.
async function withRetry(fn, tries = 3) { let last; for (let k = 0; k < tries; k++) { try { return await fn(); } catch (e) { last = e; if (!/fetch failed|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket|network|aborted|timeout/i.test(String(e && e.message))) throw e; await new Promise((r) => setTimeout(r, 1500 * (k + 1))); } } throw last; }

const args = process.argv.slice(2);
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const top = numAfter("--top", 12), skip = numAfter("--skip", 0);
const FAST = args.includes("--fast"); // --fast = sin PageSpeed (mucho más rápido para lotes grandes)
const COLD = args.includes("--cold"); // --cold = sin DataForSEO (datos gratis: Places + PageSpeed + web). Para el PRIMER email.
const file = args.find((a) => !a.startsWith("--") && a.endsWith(".csv"));
const src = file ? (isAbsolute(file) ? file : resolve(process.cwd(), file)) : resolve(REPO_ROOT, "targets", `negocios-espana-${today()}.csv`);

const lines = readFileSync(src, "utf8").split(/\r?\n/).filter(Boolean);
const head = parseCsv(lines[0]); const ix = (n) => head.indexOf(n);
const all = lines.slice(1).map(parseCsv).map((c) => ({
  ciudad: c[ix("ciudad")], vertical: c[ix("vertical")], negocio: c[ix("negocio")],
  web: c[ix("web")], place_id: c[ix("place_id")],
  channel: ix("channel") >= 0 ? c[ix("channel")] : null,
  contact: ix("contact") >= 0 ? c[ix("contact")] : null,
  wa_link: ix("wa_link") >= 0 ? c[ix("wa_link")] : null,
  email_pre: ix("email") >= 0 ? c[ix("email")] : null,
})).filter((b) => b.web);
const batch = all.slice(skip, skip + top);

const auditsDir = resolve(REPO_ROOT, "apps", "web", "audits");
mkdirSync(auditsDir, { recursive: true });

console.log(`Lote: ${batch.length} negocios (audit + email)…\n`);
let done = 0;
const rows = await mapLimit(batch, 4, async (b, i) => {
  const busca = BUSCA[b.vertical] || b.vertical;
  try {
    const [emailRes, audit] = await Promise.all([
      findEmails(b.web).catch(() => ({ best: null })),
      withRetry(() => buildAudit({ name: b.negocio, city: b.ciudad, placeId: b.place_id || undefined, website: b.web, searches: [`${busca} ${b.ciudad}`, `${busca} cerca de mí`] }, { skipSpeed: FAST, cold: COLD })),
    ]);
    const slug = slugify(`${b.negocio}-${b.ciudad}`).slice(0, 60);
    writeFileSync(resolve(auditsDir, `${slug}.html`), renderHtml(audit), "utf8");
    const email = b.email_pre || emailRes.best || null;
    const findings = projectFindings(audit);
    // Personalización real: gancho con IA SOLO sobre hechos reales de su ficha + web.
    try {
      const det = audit.business?.detail || {};
      const p = await personalize({
        negocio: b.negocio, ciudad: b.ciudad,
        category: audit.business?.category || null,
        address: det.formattedAddress || null,
        editorialSummary: det.editorialSummary?.text || null,
        title: audit.web?.title || null, h1: audit.web?.h1 || null,
        rating: audit.business?.rating ?? null, reviewsCount: audit.business?.reviews ?? null,
        reviews: (audit.gbp?.reviewsSample || []).map((r) => r.text).filter(Boolean),
      });
      findings.hook = p.hook; findings.hookGeneric = p.generic; findings.hookBasis = p.basis;
    } catch {}
    const row = {
      priority: skip + i + 1,
      slug, place_id: b.place_id || null, negocio: b.negocio, ciudad: b.ciudad, vertical: b.vertical,
      channel: b.channel || (email ? "email" : null),
      contact: b.contact || email || null,
      email, wa_link: b.wa_link || null,
      pdf_url: `https://faroseo.vercel.app/audits/${slug}.pdf`,
      audit_url: `https://faroseo.vercel.app/audits/${slug}.html`,
      findings,
    };
    row.qa = qaRow(row);
    done++; console.log(`  ✓ ${b.negocio} (${b.ciudad}) ${email ? "· " + email : "· sin email"}${findings.hookGeneric ? " · ⚠ gancho genérico" : ""}${row.qa.pass ? "" : " · ✗ QA"}`);
    return row;
  } catch (e) {
    done++; console.log(`  ✗ ${b.negocio}: ${e.message}`);
    return null;
  }
});

const ok = rows.filter(Boolean);
const withEmail = ok.filter((r) => r.email);
const csv = ["email,negocio,ciudad,audit_url"].concat(withEmail.map((r) => [r.email, r.negocio, r.ciudad, r.audit_url].map(esc).join(","))).join("\n");
const out = resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.csv`);
writeFileSync(out, csv, "utf8");
const jsonOut = resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`);
writeFileSync(jsonOut, JSON.stringify(ok, null, 2), "utf8");

console.log(`\n✅ ${ok.length}/${batch.length} audits generados y alojados en apps/web/audits/`);
console.log(`   JSON estructurado (envío + dashboard): ${jsonOut}`);
console.log(`   ${withEmail.length} con email.`);
console.log(`   ⚠ Falta: pdf-web (PDFs) + build-ops (dashboard) + REDEPLOY.`);
