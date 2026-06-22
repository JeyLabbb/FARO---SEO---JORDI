// _sent-check.mjs — mira la carpeta "Enviados" de cada cuenta por IMAP y cuenta los
// emails de HOY → progreso EN VIVO del envío (Gmail guarda en Enviados lo que sale por SMTP).
import tls from "node:tls";
import "./config.mjs";
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
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const d = new Date(); const since = `${d.getDate()}-${MON[d.getMonth()]}-${d.getFullYear()}`;

let total = 0;
for (const a of gmailAccounts()) {
  try {
    const c = await imapConnect(a.user, a.pass);
    let sel = await c.cmd('SELECT "[Gmail]/Sent Mail"');
    if (!sel.ok) sel = await c.cmd('SELECT "[Gmail]/Enviados"');
    if (!sel.ok) { console.log("  " + a.user.padEnd(28) + " (no encuentro carpeta Enviados)"); c.end(); continue; }
    const s = await c.cmd(`SEARCH SINCE ${since}`);
    const ids = parseSearch(s.text); const n = ids.length; total += n;
    let pdf = "";
    if (n && !/jeylabbb\.com/.test(a.user)) { const f = await c.cmd(`FETCH ${ids[ids.length - 1]} BODYSTRUCTURE`); pdf = /"PDF"|analisis-faro|application.{0,4}pdf/i.test(f.text) ? " · último con PDF ✓" : " · último SIN pdf ✗"; }
    console.log("  " + a.user.padEnd(28) + " " + n + " enviados hoy" + pdf);
    c.end();
  } catch (e) { console.log("  " + a.user.padEnd(28) + " err: " + e.message.slice(0, 50)); }
}
console.log(`TOTAL enviados hoy (todas las cuentas): ${total}  ·  fecha ${since}`);
