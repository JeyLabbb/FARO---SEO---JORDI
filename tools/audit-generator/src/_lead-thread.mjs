// _lead-thread.mjs — enseña el HILO real con un lead: qué nos mandó (INBOX) y qué le
// respondimos (Enviados), en la cuenta correcta, por IMAP. Para verificar de verdad, no de memoria.
//   node src/_lead-thread.mjs <email> [cuenta]
import "./config.mjs";
import tls from "node:tls";
import { gmailAccounts } from "./lib/gmail-smtp.mjs";

function imapConnect(user, pass) {
  return new Promise((res, rej) => {
    const s = tls.connect(993, "imap.gmail.com", { servername: "imap.gmail.com" });
    s.setEncoding("utf8"); s.setTimeout(30000, () => { s.destroy(); rej(new Error("timeout")); });
    let buf = "", m = null, r = null;
    const pump = () => { if (m && r) { const v = m(buf); if (v !== null) { const rr = r, out = buf; buf = ""; m = null; r = null; rr(out); } } };
    s.on("data", (d) => { buf += d; pump(); }); s.on("error", rej);
    const until = (fn) => new Promise((rs) => { m = fn; r = rs; pump(); });
    let t = 0;
    async function cmd(line) { const tag = "A" + (++t); s.write(`${tag} ${line}\r\n`); const txt = await until((b) => (new RegExp(`(?:^|\\r\\n)${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n`, "i").test(b) ? b : null)); return { ok: new RegExp(`(?:^|\\r\\n)${tag} OK`, "i").test(txt), text: txt }; }
    until((b) => (/^\* OK/.test(b) ? b : null)).then(async () => { const lg = await cmd(`LOGIN "${user}" "${pass}"`); res({ cmd, ok: lg.ok, end: () => { try { s.write("Z LOGOUT\r\n"); } catch {} s.end(); } }); }).catch(rej);
  });
}
const parseSearch = (t) => { const m = t.match(/^\* SEARCH([^\r\n]*)/m); return m ? m[1].trim().split(/\s+/).filter(Boolean) : []; };
const snip = (raw) => { const body = raw.split(/\r\n\r\n/).slice(1).join("\n").replace(/=\r?\n/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); return body; };
async function fetchMsgs(c, ids) {
  const out = [];
  for (const id of ids.slice(-4)) {
    const r = await c.cmd(`FETCH ${id} BODY.PEEK[]`);
    const m = r.text.match(/\{(\d+)\}\r\n/); if (!m) continue;
    const start = r.text.indexOf(m[0]) + m[0].length;
    const raw = r.text.slice(start, start + Number(m[1]));
    out.push({ date: (raw.match(/^Date: (.*)$/mi) || [])[1] || "", subj: (raw.match(/^Subject: (.*)$/mi) || [])[1] || "(sin asunto)", body: snip(raw) });
  }
  return out;
}

const TARGET = (process.argv[2] || "").toLowerCase().trim();
const ONLY = process.argv[3];
if (!TARGET) { console.log("Uso: node src/_lead-thread.mjs <email> [cuenta]"); process.exit(0); }

for (const a of gmailAccounts()) {
  if (ONLY && a.user !== ONLY) continue;
  let c; try { c = await imapConnect(a.user, a.pass); } catch (e) { console.log(`[${a.user}] no conecta: ${e.message}`); continue; }
  for (const [label, box, field] of [["📤 LE RESPONDIMOS", '"[Gmail]/Sent Mail"', "TO"], ["📥 NOS ESCRIBIÓ", "INBOX", "FROM"]]) {
    let sel = await c.cmd(`SELECT ${box}`);
    if (!sel.ok && box.includes("Sent")) sel = await c.cmd('SELECT "[Gmail]/Enviados"');
    if (!sel.ok) continue;
    const s = await c.cmd(`SEARCH ${field} "${TARGET}"`);
    const ids = parseSearch(s.text);
    if (!ids.length) continue;
    console.log(`\n=== ${label}  ·  cuenta ${a.user}  ·  ${ids.length} mensaje(s) ===`);
    for (const m of await fetchMsgs(c, ids)) {
      console.log(`  • ${m.date}  |  ${m.subj}  ${/190/.test(m.body) ? "  💶 menciona 190" : ""}`);
      console.log(`    ${m.body.slice(0, 240)}`);
    }
  }
  c.end();
}
