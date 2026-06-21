// scrape-emails.mjs — saca el email de la web de cada negocio y deja una hoja
// LISTA PARA MAILMETEOR: email + asunto + cuerpo personalizado por negocio.
// Es un LOTE diario (no los 5.000 de golpe).
//
//   node src/scrape-emails.mjs [archivo.csv] [--top 80] [--skip 0]
//
// NECESITA RED → dangerouslyDisableSandbox.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT, BRAND } from "./config.mjs";
import { findEmails } from "./lib/findemail.mjs";
import { today } from "./lib/slug.mjs";

const VNOUN = { dental: "tu clínica dental", estetica: "tu centro de estética", fisioterapia: "tu clínica de fisio", pilates: "tu estudio", peluqueria: "tu peluquería" };
const VBUSCA = { dental: "dentista", estetica: "centro de estética", fisioterapia: "fisioterapia", pilates: "pilates", peluqueria: "peluquería" };

function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }
const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

async function mapLimit(items, limit, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } }));
  return out;
}

function mensaje(b) {
  const busca = VBUSCA[b.vertical] || b.vertical;
  const asunto = `${b.negocio}: 3 formas de salir más arriba en Google`;
  const cuerpo =
`Hola ${b.negocio},

Soy Jordi, de ${BRAND}. Ayudamos a negocios como ${VNOUN[b.vertical] || "el tuyo"} en ${b.ciudad} a salir más arriba en Google, justo donde la gente busca «${busca} ${b.ciudad}».

Le he echado un ojo a vuestra presencia y he visto un par de cosas que probablemente os están costando clientes (en reseñas, posición y ficha). Os he preparado un análisis gratis de 1 página con 3 mejoras concretas.

¿Os lo paso? Sin compromiso, lo veis y decidís.

Un saludo,
Jordi — ${BRAND}
https://faroseo.vercel.app

PD: si no os interesa, respondedme «baja» y no os vuelvo a escribir.`;
  return { asunto, cuerpo };
}

const args = process.argv.slice(2);
const numAfter = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : def; };
const top = numAfter("--top", 80), skip = numAfter("--skip", 0);
const file = args.find((a) => !a.startsWith("--") && a.endsWith(".csv"));
const src = file ? (isAbsolute(file) ? file : resolve(process.cwd(), file)) : resolve(REPO_ROOT, "targets", `negocios-espana-${today()}.csv`);

const lines = readFileSync(src, "utf8").split(/\r?\n/).filter(Boolean);
const head = parseCsv(lines[0]); const ix = (n) => head.indexOf(n);
const all = lines.slice(1).map(parseCsv).map((c) => ({
  ciudad: c[ix("ciudad")], vertical: c[ix("vertical")], negocio: c[ix("negocio")],
  reseñas: c[ix("reseñas")], web: c[ix("web")], tel: c[ix("telefono")],
})).filter((b) => b.web);
const batch = all.slice(skip, skip + top);

console.log(`Escaneando ${batch.length} webs (de la ${skip + 1} a la ${skip + batch.length})…\n`);
let done = 0;
const rows = await mapLimit(batch, 8, async (b) => {
  const { best } = await findEmails(b.web).catch(() => ({ best: null }));
  done++; if (done % 20 === 0) console.log(`  …${done}/${batch.length}`);
  if (!best) return null;
  const { asunto, cuerpo } = mensaje(b);
  return { email: best, negocio: b.negocio, ciudad: b.ciudad, vertical: b.vertical, asunto, cuerpo };
});

const found = rows.filter(Boolean);
const headOut = ["email", "negocio", "ciudad", "vertical", "asunto", "cuerpo"];
const csv = [headOut.join(",")].concat(found.map((r) => [r.email, r.negocio, r.ciudad, r.vertical, r.asunto, r.cuerpo].map(esc).join(","))).join("\n");
const out = resolve(REPO_ROOT, "targets", `emails-HOY-${today()}.csv`);
writeFileSync(out, csv, "utf8");

console.log(`\n✅ ${found.length} emails encontrados de ${batch.length} webs (${Math.round(100 * found.length / batch.length)}%)`);
console.log(`   Listo para Mailmeteor → ${out}`);
console.log(`   Columnas: email · asunto · cuerpo (ya personalizados). Verifica los emails en Mailmeteor antes de enviar.`);
