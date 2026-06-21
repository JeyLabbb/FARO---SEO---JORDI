// _lead-bodies.mjs — lee el CUERPO de los emails-respuesta (leads) detectados por
// _inbox-check, vía IMAP. Solo respuestas reales: "Re:" de un remitente externo.
// Sin dependencias. NECESITA RED → dangerouslyDisableSandbox.
//   node src/_lead-bodies.mjs
import tls from "node:tls";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { gmailAccounts } from "./lib/gmail-smtp.mjs";
import { today } from "./lib/slug.mjs";

function imapConnect(user, pass) {
  return new Promise((resolveConn, rejectConn) => {
    const socket = tls.connect(993, "imap.gmail.com", { servername: "imap.gmail.com" });
    socket.setEncoding("utf8");
    socket.setTimeout(60000, () => { socket.destroy(); rejectConn(new Error("timeout IMAP")); });
    let buf = "", matcher = null, resolver = null;
    const pump = () => { if (matcher && resolver) { const r = matcher(buf); if (r !== null) { const res = resolver, out = buf; buf = ""; matcher = null; resolver = null; res(out); } } };
    socket.on("data", (d) => { buf += d; pump(); });
    socket.on("error", rejectConn);
    const until = (fn) => new Promise((res) => { matcher = fn; resolver = res; pump(); });
    let tagN = 0;
    async function cmd(line) {
      const tag = "A" + (++tagN);
      socket.write(`${tag} ${line}\r\n`);
      const text = await until((b) => (new RegExp(`(?:^|\\r\\n)${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n`, "i").test(b) ? b : null));
      return { ok: new RegExp(`(?:^|\\r\\n)${tag} OK`, "i").test(text), text };
    }
    until((b) => (/^\* OK/.test(b) ? b : null)).then(async () => {
      try { const lg = await cmd(`LOGIN "${user}" "${pass}"`); resolveConn({ cmd, ok: lg.ok, end: () => { try { socket.write("Z LOGOUT\r\n"); } catch {} socket.end(); } }); }
      catch (e) { rejectConn(e); }
    });
  });
}
const parseSearch = (text) => { const m = text.match(/^\* SEARCH([^\r\n]*)/m); return m ? m[1].trim().split(/\s+/).filter(Boolean) : []; };
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const fromB64 = (s) => { try { return Buffer.from(s.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { return s; } };
const stripHtml = (h) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<\/(p|div|br|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n");
function extractText(raw) {
  const sep = raw.indexOf("\r\n\r\n");
  const head = sep >= 0 ? raw.slice(0, sep) : "";
  let body = sep >= 0 ? raw.slice(sep + 4) : raw;
  const bnd = (head.match(/boundary="?([^";\r\n]+)"?/i) || [])[1];
  let chosen = body, cte = (head.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [])[1] || "";
  let isHtml = /Content-Type:\s*text\/html/i.test(head);
  if (bnd) {
    const parts = body.split(new RegExp(`--${bnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).slice(1);
    const decoded = parts.map((p) => { const s2 = p.indexOf("\r\n\r\n"); const ph = s2 >= 0 ? p.slice(0, s2) : ""; const pb = s2 >= 0 ? p.slice(s2 + 4) : p; return { ph, pb, plain: /text\/plain/i.test(ph), html: /text\/html/i.test(ph), cte: (ph.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [])[1] || "" }; });
    const pick = decoded.find((d) => d.plain) || decoded.find((d) => d.html);
    if (pick) { chosen = pick.pb; cte = pick.cte; isHtml = pick.html && !pick.plain; }
  }
  if (/base64/i.test(cte)) chosen = fromB64(chosen);
  else if (/quoted-printable/i.test(cte)) chosen = decodeQP(chosen);
  if (isHtml) chosen = stripHtml(chosen);
  // recorta la cita del email original
  const lines = chosen.split(/\r?\n/);
  const cut = lines.findIndex((l) => /^>|^El .*escribió:|^On .*wrote:|-{5,} ?Mensaje|Una revisión rápida|wrote:$/i.test(l.trim()));
  if (cut > 2) chosen = lines.slice(0, cut).join("\n");
  return chosen.trim().replace(/\n{3,}/g, "\n\n").slice(0, 1800);
}

const state = JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", `inbox-state-${today()}.json`), "utf8"));
const ours = new Set(gmailAccounts().map((a) => a.user));
const leads = state.replies.filter((r) => /^re:/i.test(r.subject || "") && !ours.has(r.fromEmail));
const byAcc = {};
for (const l of leads) (byAcc[l.account] ||= []).push(l);
console.log(`Leads reales (respuestas "Re:"): ${leads.length}\n`);

const accs = gmailAccounts();
for (const acc of accs) {
  const ls = byAcc[acc.user]; if (!ls || !ls.length) continue;
  let conn; try { conn = await imapConnect(acc.user, acc.pass); } catch (e) { console.log(`✗ ${acc.user}: ${e.message}`); continue; }
  if (!conn.ok) { console.log(`✗ ${acc.user}: login`); continue; }
  await conn.cmd("SELECT INBOX");
  for (const l of ls) {
    const s = await conn.cmd(`SEARCH FROM "${l.fromEmail}"`);
    const ids = parseSearch(s.text); const id = ids[ids.length - 1];
    if (!id) { console.log(`(sin cuerpo) ${l.fromEmail}`); continue; }
    const f = await conn.cmd(`FETCH ${id} (BODY.PEEK[])`);
    const raw = f.text.replace(/^[\s\S]*?BODY\[\]\s*\{\d+\}\r\n/, "").replace(/\r\n\)\r\n[\s\S]*$/, "");
    console.log(`══════════════════════════════════════════`);
    console.log(`DE: ${l.fromEmail}   (cuenta ${acc.user})`);
    console.log(`ASUNTO: ${l.subject}`);
    console.log(`FECHA: ${l.date}`);
    console.log(`──────────`);
    console.log(extractText(raw) || "(cuerpo vacío)");
    console.log("");
  }
  conn.end();
}
