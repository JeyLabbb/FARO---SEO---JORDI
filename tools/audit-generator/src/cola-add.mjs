// cola-add.mjs — RELLENA el almacén (cola.json) con audits cold nuevos, ya filtrados.
// Dedup por place_id Y por email contra la cola, los descartados y el sent-log. Solo
// entra lo que pasa el QA; lo que no, se anota en "descartados" para no re-auditarlo.
//   node src/cola-add.mjs <fuente.csv> [--target 1000] [--batch 50]
// NECESITA RED → dangerouslyDisableSandbox.  (cwd: tools/audit-generator)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { buildAudit } from "./lib/audit.mjs";
import { renderHtml } from "./lib/render.mjs";
import { findEmails } from "./lib/findemail.mjs";
import { personalize } from "./lib/personalize.mjs";
import { qaRow, validEmail } from "./lib/qa.mjs";
import { projectFindings } from "./lib/email-copy.mjs";
import { slugify } from "./lib/slug.mjs";
import { mvVerify, saveMvCache } from "./lib/millionverifier.mjs";

const BUSCA = { dental: "dentista", estetica: "centro de estética", fisioterapia: "fisioterapia", pilates: "pilates", peluqueria: "peluquería" };
const args = process.argv.slice(2);
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const TARGET = numAfter("--target", 1000);
const BATCH = numAfter("--batch", 50);
const file = args.find((a) => !a.startsWith("--") && a.endsWith(".csv"));
if (!file) { console.error("Uso: node src/cola-add.mjs <fuente.csv> [--target 1000] [--batch 50]"); process.exit(1); }
const src = isAbsolute(file) ? file : resolve(process.cwd(), file);

function parseCsv(line){const o=[];let c="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch==='"'){if(line[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}else{if(ch===","){o.push(c);c="";}else if(ch==='"')q=true;else c+=ch;}}o.push(c);return o;}
const norm = (e) => String(e || "").toLowerCase().replace(/\s+/g, "");

const T = (p) => resolve(REPO_ROOT, "targets", p);
const colaPath = T("cola.json");
const cola = existsSync(colaPath) ? JSON.parse(readFileSync(colaPath, "utf8")) : { items: {}, descartados: {} };
cola.items = cola.items || {}; cola.descartados = cola.descartados || {};
const sentLog = existsSync(T("sent-log.json")) ? JSON.parse(readFileSync(T("sent-log.json"), "utf8")) : {};

// índices de dedup
const knownIds = new Set([...Object.keys(cola.items), ...Object.keys(cola.descartados), ...Object.keys(sentLog)]);
const knownEmails = new Set();
for (const it of Object.values(cola.items)) if (it.email) knownEmails.add(norm(it.email));
for (const v of Object.values(sentLog)) if (v.to) knownEmails.add(norm(v.to));

const listoCount = () => Object.values(cola.items).filter((i) => i.status === "listo").length;

const lines = readFileSync(src, "utf8").split(/\r?\n/).filter(Boolean);
const head = parseCsv(lines[0]); const ix = (n) => head.indexOf(n);
const rows = lines.slice(1).map(parseCsv).map((c) => ({
  ciudad: c[ix("ciudad")], vertical: c[ix("vertical")], negocio: c[ix("negocio")],
  web: c[ix("web")], place_id: c[ix("place_id")],
  email_pre: ix("email") >= 0 ? c[ix("email")] : null,
})).filter((b) => b.web && b.place_id && !knownIds.has(b.place_id));

const auditsDir = resolve(REPO_ROOT, "apps", "web", "audits");
mkdirSync(auditsDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, tries = 3) { let last; for (let k = 0; k < tries; k++) { try { return await fn(); } catch (e) { last = e; if (!/fetch failed|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket|network|aborted|timeout/i.test(String(e && e.message))) throw e; await sleep(1500 * (k + 1)); } } throw last; }

let added = 0, skipped = 0, tried = 0, idx = 0;
console.log(`Almacén: ${listoCount()} listos. Objetivo ${TARGET}. Procesando hasta ${BATCH} nuevos de ${rows.length} candidatos…\n`);

async function worker() {
  while (true) {
    if (listoCount() >= TARGET || tried >= BATCH) return;
    const b = rows[idx++]; if (!b) return;
    tried++;
    const busca = BUSCA[b.vertical] || b.vertical;
    try {
      // 1) Email primero (gratis): sin email válido → descartar SIN gastar el audit (Places).
      const email = b.email_pre || (await findEmails(b.web).catch(() => ({ best: null }))).best || null;
      const emailN = norm(email);
      if (!validEmail(email)) { cola.descartados[b.place_id] = "sin email válido"; skipped++; console.log(`  ✗ ${b.negocio}: sin email válido`); continue; }
      if (knownEmails.has(emailN)) { skipped++; console.log(`  ↷ ${b.negocio}: email duplicado`); continue; }
      // 1b) Verificación del email (MillionVerifier si hay key; si no, gratis): muerto → fuera SIN gastar el audit.
      const mv = await mvVerify(email);
      if (mv.verdict === "dead") { cola.descartados[b.place_id] = `email muerto (${mv.result})`; skipped++; console.log(`  ✗ ${b.negocio}: email muerto (${mv.result})`); continue; }
      // 2) Solo ahora gastamos el audit cold (Places + PageSpeed + web).
      const audit = await withRetry(() => buildAudit({ name: b.negocio, city: b.ciudad, placeId: b.place_id, website: b.web, searches: [`${busca} ${b.ciudad}`, `${busca} cerca de mí`] }, { cold: true }));
      const findings = projectFindings(audit);
      try {
        const det = audit.business?.detail || {};
        const p = await personalize({ negocio: b.negocio, ciudad: b.ciudad, category: audit.business?.category || null, address: det.formattedAddress || null, editorialSummary: det.editorialSummary?.text || null, title: audit.web?.title || null, h1: audit.web?.h1 || null, rating: audit.business?.rating ?? null, reviewsCount: audit.business?.reviews ?? null, reviews: (audit.gbp?.reviewsSample || []).map((r) => r.text).filter(Boolean) });
        findings.hook = p.hook; findings.hookGeneric = p.generic; findings.hookBasis = p.basis;
      } catch {}
      const slug = slugify(`${b.negocio}-${b.ciudad}`).slice(0, 60);
      const row = { place_id: b.place_id, slug, negocio: b.negocio, ciudad: b.ciudad, vertical: b.vertical, channel: "email", contact: email, email, wa_link: null, pdf_url: `https://faroseo.vercel.app/audits/${slug}.pdf`, audit_url: `https://faroseo.vercel.app/audits/${slug}.html`, findings, mv: { verdict: mv.verdict, result: mv.result } };
      const qa = qaRow(row); row.qa = qa;
      if (!qa.pass) { cola.descartados[b.place_id] = qa.flags.map((f) => f.msg).join("; "); skipped++; console.log(`  ✗ ${b.negocio}: ${cola.descartados[b.place_id]}`); continue; }
      writeFileSync(resolve(auditsDir, `${slug}.html`), renderHtml(audit), "utf8");
      row.status = "listo"; row.addedAt = new Date().toISOString();
      cola.items[b.place_id] = row;
      if (emailN) knownEmails.add(emailN);
      knownIds.add(b.place_id);
      added++; console.log(`  ✓ ${b.negocio} (${b.ciudad}) ${email || "· sin email"}${findings.hookGeneric ? " · gancho genérico" : ""}`);
      if (added % 5 === 0) writeFileSync(colaPath, JSON.stringify(cola, null, 2), "utf8");
    } catch (e) { skipped++; console.log(`  ⚠ ${b.negocio}: ${e.message}`); }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
saveMvCache();
writeFileSync(colaPath, JSON.stringify(cola, null, 2), "utf8");
console.log(`\nAñadidos: ${added} · saltados/descartados: ${skipped} · almacén ahora: ${listoCount()} listos · ${Object.keys(cola.descartados).length} descartados.`);
console.log(`→ ${colaPath}`);
