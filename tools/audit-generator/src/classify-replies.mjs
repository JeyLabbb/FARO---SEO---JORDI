// classify-replies.mjs — lee las RESPUESTAS reales (de inbox-state), saca el cuerpo
// por IMAP y las clasifica con IA (gpt-4o-mini): interesado / no_interesado / baja /
// fuera_oficina / automatico / pregunta + resumen + acción sugerida.
// Escribe targets/leads-FECHA.json (lo consume el panel). NECESITA RED → dangerouslyDisableSandbox.
//   node src/classify-replies.mjs
import tls from "node:tls";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { gmailAccounts } from "./lib/gmail-smtp.mjs";
import { today } from "./lib/slug.mjs";

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const T = (p) => resolve(REPO_ROOT, "targets", p);

// ── IMAP mínimo (igual que _lead-bodies) ──
function imapConnect(user, pass) {
  return new Promise((res, rej) => {
    const s = tls.connect(993, "imap.gmail.com", { servername: "imap.gmail.com" });
    s.setEncoding("utf8"); s.setTimeout(60000, () => { s.destroy(); rej(new Error("timeout")); });
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
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const fromB64 = (s) => { try { return Buffer.from(s.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { return s; } };
const stripHtml = (h) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
function extractText(raw) {
  const sep = raw.indexOf("\r\n\r\n"); const head = sep >= 0 ? raw.slice(0, sep) : ""; let body = sep >= 0 ? raw.slice(sep + 4) : raw;
  const bnd = (head.match(/boundary="?([^";\r\n]+)"?/i) || [])[1]; let chosen = body, cte = (head.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [])[1] || "", isHtml = /text\/html/i.test(head);
  if (bnd) { const parts = body.split(new RegExp(`--${bnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).slice(1).map((p) => { const s2 = p.indexOf("\r\n\r\n"); const ph = s2 >= 0 ? p.slice(0, s2) : ""; return { ph, pb: s2 >= 0 ? p.slice(s2 + 4) : p, plain: /text\/plain/i.test(ph), html: /text\/html/i.test(ph), cte: (ph.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [])[1] || "" }; }); const pick = parts.find((d) => d.plain) || parts.find((d) => d.html); if (pick) { chosen = pick.pb; cte = pick.cte; isHtml = pick.html && !pick.plain; } }
  if (/base64/i.test(cte)) chosen = fromB64(chosen); else if (/quoted-printable/i.test(cte)) chosen = decodeQP(chosen);
  if (isHtml) chosen = stripHtml(chosen);
  const lines = chosen.split(/\r?\n/); const cut = lines.findIndex((l) => /^>|^El .*escribió:|^On .*wrote:|-{5,} ?Mensaje|Enviado desde|wrote:$/i.test(l.trim()));
  if (cut > 1) chosen = lines.slice(0, cut).join("\n");
  return chosen.trim().replace(/\s+/g, " ").slice(0, 1200);
}

async function classify(negocio, body) {
  if (!OPENAI_KEY) return { estado: "sin_clave", resumen: body.slice(0, 60), accion: "" };
  const sys = "Clasificas respuestas a un email de venta en frío de un servicio de SEO local. Devuelves SOLO JSON válido, sin texto extra.";
  const usr = `Respuesta del negocio «${negocio || "?"}»:\n"""${body}"""\nDevuelve {"estado": uno de ["interesado","no_interesado","baja","fuera_oficina","automatico","pregunta"], "resumen": "máx 7 palabras", "accion": "qué haría Jordi, 1 frase corta"}. "baja"=el negocio cerró/cambió de dueño/no existe.`;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` }, body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: sys }, { role: "user", content: usr }] }) });
    const d = await r.json(); const txt = d.choices?.[0]?.message?.content || "{}"; const j = JSON.parse(txt);
    return { estado: j.estado || "?", resumen: j.resumen || "", accion: j.accion || "" };
  } catch (e) { return { estado: "error", resumen: e.message.slice(0, 50), accion: "" }; }
}

// sent-log → email→{negocio via findings}
const sent = JSON.parse(readFileSync(T("sent-log.json"), "utf8"));
const emailToPid = new Map(); for (const [pid, v] of Object.entries(sent)) { if (v.to) emailToPid.set(v.to.toLowerCase(), pid); }
const fmap = new Map();
for (const f of readdirSync(resolve(REPO_ROOT, "targets")).filter((n) => /^envios-HOY-.*\.json$/.test(n))) { try { for (const r of JSON.parse(readFileSync(T(f), "utf8"))) if (r.place_id && !fmap.has(r.place_id)) fmap.set(r.place_id, r.negocio); } catch {} }
const negFor = (email) => fmap.get(emailToPid.get((email || "").toLowerCase())) || "";

const state = JSON.parse(readFileSync(T(`inbox-state-${today()}.json`), "utf8"));
const ours = new Set(gmailAccounts().map((a) => a.user));
const reps = (state.replies || []).filter((r) => /^re:/i.test(r.subject || "") && !ours.has(r.fromEmail));
console.log(`Respuestas a clasificar: ${reps.length}`);

const accs = gmailAccounts(); const accByUser = new Map(accs.map((a) => [a.user, a]));
const conns = new Map();
const leads = [];
for (const r of reps) {
  const acc = accByUser.get(r.account); if (!acc) continue;
  let conn = conns.get(r.account);
  if (!conn) { try { conn = await imapConnect(acc.user, acc.pass); await conn.cmd("SELECT INBOX"); conns.set(r.account, conn); } catch { continue; } }
  const s = await conn.cmd(`SEARCH FROM "${r.fromEmail}"`); const ids = parseSearch(s.text); const id = ids[ids.length - 1];
  let body = "";
  if (id) { const f = await conn.cmd(`FETCH ${id} (BODY.PEEK[])`); body = extractText(f.text.replace(/^[\s\S]*?BODY\[\]\s*\{\d+\}\r\n/, "").replace(/\r\n\)\r\n[\s\S]*$/, "")); }
  const negocio = negFor(r.fromEmail);
  const cls = await classify(negocio, body);
  console.log(`  ${cls.estado.padEnd(13)} ${r.fromEmail}  — ${cls.resumen}`);
  leads.push({ email: r.fromEmail, negocio, account: r.account, date: r.date, estado: cls.estado, resumen: cls.resumen, accion: cls.accion, body });
}
for (const c of conns.values()) c.end();
writeFileSync(T(`leads-${today()}.json`), JSON.stringify(leads, null, 2), "utf8");
console.log(`\n→ ${T(`leads-${today()}.json`)} (${leads.length} leads)`);
