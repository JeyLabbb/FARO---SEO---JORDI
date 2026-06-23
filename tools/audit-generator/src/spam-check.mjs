// spam-check.mjs — MONITOR DE COLOCACIÓN (bandeja vs spam). Cada cuenta de envío manda un
// email-semilla con un token único a un buzón que SÍ controlamos; luego leemos ese buzón por
// IMAP y miramos en qué carpeta cayó (BANDEJA o SPAM). Así SABEMOS, con datos, qué cuentas
// están yendo a spam — no lo adivinamos. Escribe targets/spam-state.json (lo lee caps.mjs:
// una cuenta en spam deja de enviar). NECESITA RED → dangerouslyDisableSandbox.
//   node src/spam-check.mjs [--wait 75]
// Límite honesto: solo prueba colocación Gmail→Gmail (nuestros buzones). Para Outlook/otros
// haría falta una semilla en ese proveedor (se añade a SEEDS).
import tls from "node:tls";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { sendMail, gmailAccounts } from "./lib/gmail-smtp.mjs";

const args = process.argv.slice(2);
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const WAIT = numAfter("--wait", 75);

// ── IMAP mínimo (adaptado de _inbox-check) ──
function imap(user, pass) {
  return new Promise((res, rej) => {
    const s = tls.connect(993, "imap.gmail.com", { servername: "imap.gmail.com" });
    s.setEncoding("utf8"); s.setTimeout(60000, () => { s.destroy(); rej(new Error("timeout IMAP")); });
    let buf = "", matcher = null, resolver = null;
    const pump = () => { if (matcher && resolver) { const r = matcher(buf); if (r !== null) { const rs = resolver, o = buf; buf = ""; matcher = null; resolver = null; rs(o); } } };
    s.on("data", (d) => { buf += d; pump(); }); s.on("error", rej);
    const until = (fn) => new Promise((r) => { matcher = fn; resolver = r; pump(); });
    let n = 0;
    async function cmd(line) { const tag = "A" + (++n); s.write(tag + " " + line + "\r\n"); const t = await until((b) => new RegExp(`(?:^|\\r\\n)${tag} (OK|NO|BAD)`, "i").test(b) ? b : null); return { ok: new RegExp(`(?:^|\\r\\n)${tag} OK`, "i").test(t), text: t }; }
    until((b) => /^\* OK/.test(b) ? b : null).then(async () => { const lg = await cmd(`LOGIN "${user}" "${pass}"`); res({ cmd, ok: lg.ok, end: () => { try { s.write("Z LOGOUT\r\n"); } catch {} s.end(); } }); });
  });
}
const searchHits = (text) => { const m = text.match(/^\* SEARCH([^\r\n]*)/m); return m ? m[1].trim().split(/\s+/).filter(Boolean) : []; };
// Descubre la carpeta de SPAM (\Junk) por su atributo especial → robusto en cualquier idioma.
function junkFolder(listText) {
  for (const line of listText.split(/\r?\n/)) {
    const m = line.match(/^\* LIST \(([^)]*)\)\s+"[^"]*"\s+"?([^"]+?)"?\s*$/);
    if (m && /\\Junk/i.test(m[1])) return m[2];
  }
  return "[Gmail]/Spam";
}

const accs = gmailAccounts();
if (accs.length < 2) { console.error("✗ Necesito ≥2 cuentas (una manda, otra hace de buzón)."); process.exit(1); }
const byUser = Object.fromEntries(accs.map((a) => [a.user, a]));
const SEEDS = ["yourbusinesstry@gmail.com", "borrutjordi548@gmail.com"].filter((e) => byUser[e]);
if (!SEEDS.length) { console.error("✗ Sin buzón semilla legible (yourbusinesstry / borrutjordi)."); process.exit(1); }

const stamp = Date.now();
const tests = [];
console.log("Enviando emails-semilla (1 por cuenta)…");
for (let i = 0; i < accs.length; i++) {
  const s = accs[i];
  const seed = SEEDS.find((x) => x !== s.user) || SEEDS[0];
  const token = `FAROSEED${stamp}I${i}`;
  try {
    await sendMail({ user: s.user, pass: s.pass, fromName: "Faro", to: seed, subject: `${token} test colocacion`, text: `Test interno de colocacion (${token}). Ignorar / borrar.` });
    tests.push({ sender: s.user, seed, token, placement: "pending" });
    console.log(`  ✓ ${s.user} → ${seed}`);
  } catch (e) { tests.push({ sender: s.user, seed, token, placement: "send-error" }); console.log(`  ✗ ${s.user}: ${e.message}`); }
}

console.log(`\nEsperando ${WAIT}s a que Gmail entregue y clasifique…`);
await new Promise((r) => setTimeout(r, WAIT * 1000));

for (const seed of SEEDS) {
  const mine = tests.filter((t) => t.seed === seed && t.placement === "pending");
  if (!mine.length) continue;
  let conn; try { conn = await imap(byUser[seed].user, byUser[seed].pass); } catch (e) { console.log(`  ✗ IMAP ${seed}: ${e.message}`); continue; }
  if (!conn.ok) { console.log(`  ✗ LOGIN ${seed}`); conn.end(); continue; }
  const junk = junkFolder((await conn.cmd('LIST "" "*"')).text);
  for (const t of mine) {
    await conn.cmd(`SELECT "${junk}"`);
    if (searchHits((await conn.cmd(`SEARCH HEADER SUBJECT "${t.token}"`)).text).length) { t.placement = "spam"; continue; }
    await conn.cmd("SELECT INBOX");
    t.placement = searchHits((await conn.cmd(`SEARCH HEADER SUBJECT "${t.token}"`)).text).length ? "inbox" : "not-found";
  }
  conn.end();
}

const byAccount = {};
for (const t of tests) byAccount[t.sender] = { placement: t.placement, seed: t.seed };
writeFileSync(resolve(REPO_ROOT, "targets", "spam-state.json"), JSON.stringify({ at: new Date().toISOString(), byAccount }, null, 2), "utf8");

console.log("\n=== COLOCACIÓN POR CUENTA ===");
for (const [acc, o] of Object.entries(byAccount)) console.log(`  ${acc.padEnd(28)} → ${String(o.placement).toUpperCase()}`);
const spamAccts = Object.entries(byAccount).filter(([, o]) => o.placement === "spam").map(([a]) => a);
console.log(spamAccts.length ? `\n⚠️ EN SPAM (se pararán solas): ${spamAccts.join(", ")}` : "\n✅ Ninguna cuenta en spam ahora mismo.");
console.log("→ targets/spam-state.json");
