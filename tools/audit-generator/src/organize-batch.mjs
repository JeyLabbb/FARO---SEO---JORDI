// organize-batch.mjs — coge los mejores ~400 negocios y los reparte, MUY
// organizado, en 3 listas de acción: LLAMADAS (las mejores, a mano),
// WHATSAPP (las siguientes, a mano) y EMAIL (todas las que tengan email, las
// envío yo). Saca el email de cada web por el camino.
//
//   node src/organize-batch.mjs [archivo.csv] [--top 400] [--call 150] [--wa 90]
//
// NECESITA RED → dangerouslyDisableSandbox.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT, BRAND } from "./config.mjs";
import { findEmails } from "./lib/findemail.mjs";
import { today } from "./lib/slug.mjs";

const VBUSCA = { dental: "dentista", estetica: "centro de estética", fisioterapia: "fisioterapia", pilates: "pilates", peluqueria: "peluquería" };

function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }
const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function mapLimit(items, limit, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } })); return out; }

// Email válido: descarta placeholders (tu@email.com, tusdatos@…) y dominios de ejemplo.
const PH_DOMAINS = new Set(["email.com", "example.com", "example.org", "example.net", "domain.com", "dominio.com", "tudominio.com", "yourdomain.com", "test.com", "correo.com"]);
const PH_LOCALS = new Set(["tu", "tucorreo", "tusdatos", "tuemail", "tunombre", "your", "youremail", "yourname", "ejemplo", "example", "nombre", "correo", "emailaddress"]);
function cleanEmail(raw) { let e; try { e = decodeURIComponent(String(raw || "")); } catch { e = String(raw || ""); } return e.replace(/\s+/g, "").toLowerCase(); }
function validEmail(raw) { const e = cleanEmail(raw); if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return false; const [loc, dom] = e.split("@"); return !PH_DOMAINS.has(dom) && !PH_LOCALS.has(loc); }

function gancho(b) {
  const v = VBUSCA[b.vertical] || b.vertical;
  if (b.reviews && b.reviews < 35) return `Solo ${b.reviews} reseñas para «${v} ${b.ciudad}» — fácil de subir`;
  if (b.nota && b.nota < 4.5) return `Nota ${b.nota}: se sube respondiendo/pidiendo reseñas, y subimos su posición`;
  return `Margen para salir más arriba cuando buscan «${v} ${b.ciudad}»`;
}
// Móvil español = empieza por 6 o 7 (quitando prefijo +34). Los 8/9 son fijos → NO WhatsApp.
const isMobile = (tel) => /^[67]/.test((tel || "").replace(/[^\d]/g, "").replace(/^(?:00)?34/, ""));
// Mensaje WhatsApp BÁSICO (sin emojis, salen raros). Para los que aún no tienen audit;
// a los de hoy el dashboard les pone una versión con sus datos reales.
function waLink(b) {
  const v = VBUSCA[b.vertical] || b.vertical;
  const hook = b.reviews && b.reviews < 40 ? ` Por ejemplo, en reseñas vais algo cortos para lo que se mueve en «${v} ${b.ciudad}».` : "";
  const msg = `Hola ${b.negocio}, soy Jordi (de ${BRAND}). Le he echado un ojo a cómo aparecéis en Google en ${b.ciudad} y he visto un par de cosas que os pueden estar costando clientes frente a vuestra competencia.${hook} Os he preparado un análisis gratis de 1 página con el detalle (vuestros números y los de los de al lado). ¿Os lo paso?`;
  return `https://wa.me/${(b.tel || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
}

const args = process.argv.slice(2);
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const top = num("--top", 400), callN = num("--call", 150), waN = num("--wa", 90);
const file = args.find((a) => !a.startsWith("--") && a.endsWith(".csv"));
const src = file ? (isAbsolute(file) ? file : resolve(process.cwd(), file)) : resolve(REPO_ROOT, "targets", `negocios-espana-${today()}.csv`);

const lines = readFileSync(src, "utf8").split(/\r?\n/).filter(Boolean);
const head = parseCsv(lines[0]); const ix = (n) => head.indexOf(n);
const all = lines.slice(1).map(parseCsv).map((c) => ({
  ciudad: c[ix("ciudad")], vertical: c[ix("vertical")], negocio: c[ix("negocio")],
  reviews: Number(c[ix("reseñas")]) || null, nota: Number(c[ix("nota")]) || null,
  web: c[ix("web")], tel: c[ix("telefono")], place_id: c[ix("place_id")],
})).filter((b) => b.web || b.tel);
const pool = all.slice(0, top);

console.log(`Organizando ${pool.length} negocios (sacando emails)…`);
let done = 0;
await mapLimit(pool, 8, async (b) => { const best = (await findEmails(b.web).catch(() => ({ best: null }))).best; b.email = validEmail(best) ? cleanEmail(best) : null; done++; if (done % 50 === 0) console.log(`  …${done}/${pool.length}`); });

// Reparto EXCLUSIVO: cada negocio en UN solo canal (sin solapes Gym-dance-en-llamadas-Y-emails).
//  1) LLAMADAS = los mejores con teléfono (merecen la llamada, convierte más).
//  2) EMAIL    = del resto, los que tienen email válido (los envío yo, automático → escala sin tu tiempo).
//  3) WHATSAPP = del resto, los que tienen web+teléfono pero NO email.
const withPhone = pool.filter((b) => b.tel);
const assigned = new Set();
// 1) LLAMADAS = mejores con teléfono (cualquier número sirve para llamar).
let callList = withPhone.slice(0, callN);
callList.forEach((b) => assigned.add(b.place_id));
// 2) EMAIL = del resto, con email válido (los envío yo).
const emailList = pool.filter((b) => b.email && !assigned.has(b.place_id));
emailList.forEach((b) => assigned.add(b.place_id));
// 3) WHATSAPP = del resto, con web + MÓVIL (6/7) + sin email. Los fijos 9xx NO van aquí.
const waList = pool.filter((b) => b.web && b.tel && isMobile(b.tel) && !assigned.has(b.place_id));
waList.forEach((b) => assigned.add(b.place_id));
// 4) Lo que queda con teléfono (fijos sin email) solo se puede LLAMAR → cola de llamadas.
const callOverflow = pool.filter((b) => b.tel && !assigned.has(b.place_id));
callOverflow.forEach((b) => assigned.add(b.place_id));
callList = callList.concat(callOverflow);

const writeCsv = (name, headArr, rows, fn) => {
  const csv = [headArr.join(",")].concat(rows.map((r, i) => fn(r, i).map(esc).join(","))).join("\n");
  const out = resolve(REPO_ROOT, "targets", `${name}-${today()}.csv`);
  writeFileSync(out, csv, "utf8"); return out;
};

const cOut = writeCsv("lote-LLAMADAS", ["#", "negocio", "ciudad", "vertical", "reseñas", "nota", "telefono", "place_id", "gancho"], callList, (b, i) => [i + 1, b.negocio, b.ciudad, b.vertical, b.reviews, b.nota, b.tel, b.place_id, gancho(b)]);
const wOut = writeCsv("lote-WHATSAPP", ["#", "negocio", "ciudad", "telefono", "place_id", "wa_link"], waList, (b, i) => [i + 1, b.negocio, b.ciudad, b.tel, b.place_id, waLink(b)]);
const eOut = writeCsv("lote-EMAIL", ["email", "negocio", "ciudad", "vertical", "place_id"], emailList, (b) => [b.email, b.negocio, b.ciudad, b.vertical, b.place_id]);

console.log(`\n──────── 3 LISTAS ORGANIZADAS ────────`);
console.log(`  📞 LLAMADAS (las mejores, a mano):   ${callList.length}  → ${cOut}`);
console.log(`  💬 WHATSAPP (las siguientes, a mano): ${waList.length}  → ${wOut}`);
console.log(`  ✉️  EMAIL (con email, las envío yo):  ${emailList.length}  → ${eOut}`);
console.log(`\n  Nota: el audit (PDF) se genera por TANDAS según lo que se contacte cada día,`);
console.log(`  no los 400 de golpe (sería ~1h y no se puede contactar a 400 en un día).`);
