// _inbox-check.mjs — revisa la BANDEJA de cada cuenta Gmail de Faro vía IMAP usando
// la "contraseña de aplicación" (la misma del SMTP). Clasifica:
//   • REBOTES (mailer-daemon) → extrae el destinatario que falló (no volver a escribirle)
//   • RESPUESTAS humanas → posibles LEADS (responder a mano, NO seguir con secuencia)
// Cruza con sent-log.json para mapear email → place_id. Vuelca el estado a
//   targets/inbox-state-<fecha>.json  (lo consume el motor de seguimiento).
// Sin dependencias (IMAP a mano sobre node:tls). NECESITA RED → dangerouslyDisableSandbox.
//   node src/_inbox-check.mjs
import tls from "node:tls";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { gmailAccounts } from "./lib/gmail-smtp.mjs";
import { today } from "./lib/slug.mjs";

// ── conexión IMAP mínima ───────────────────────────────────────────────────
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
      try {
        const lg = await cmd(`LOGIN "${user}" "${pass}"`);
        resolveConn({ cmd, ok: lg.ok, end: () => { try { socket.write("Z LOGOUT\r\n"); } catch {} socket.end(); } });
      } catch (e) { rejectConn(e); }
    });
  });
}

const parseSearch = (text) => { const m = text.match(/^\* SEARCH([^\r\n]*)/m); return m ? m[1].trim().split(/\s+/).filter(Boolean) : []; };
function decodeMime(s) {
  if (!s) return "";
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, data) => {
    try {
      if (enc.toUpperCase() === "B") return Buffer.from(data, "base64").toString("utf8");
      return Buffer.from(data.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), "binary").toString("utf8");
    } catch { return data; }
  }).replace(/\?=\s*=\?[^?]+\?[BbQq]\?/g, "");
}
const headerField = (block, name) => { const m = block.match(new RegExp(`^${name}:\\s*([^\\r\\n]*(?:\\r\\n\\s+[^\\r\\n]*)*)`, "im")); return m ? m[1].replace(/\r\n\s+/g, " ").trim() : ""; };
const emailIn = (s) => { const m = String(s || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m ? m[0].toLowerCase() : ""; };

// ── sent-log → email→place_id ───────────────────────────────────────────────
const sentLog = (() => { try { return JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", "sent-log.json"), "utf8")); } catch { return {}; } })();
const emailToPlace = new Map();
for (const [pid, v] of Object.entries(sentLog)) { const e = (v.to || "").trim().toLowerCase(); if (e) emailToPlace.set(e, pid); }

const accounts = gmailAccounts();
if (!accounts.length) { console.error("✗ Sin GMAIL_ACCOUNTS en ~/.faro/.env"); process.exit(1); }
const OUR_ACCOUNTS = new Set(accounts.map((a) => a.user.toLowerCase()));
// Ruido que convive en estas bandejas y NO son leads: warmup de Smartlead (dominios rotativos),
// notificaciones de plataformas y nuestros propios emails internos (seeds del spam-check, partes).
const WARMUP_NOISE = /@(maleoptimization\.com|truehealthdigest\.com|rekommendai\.com|xenonbridge\.help|unistudiosproject\.eu)$/i;
// OJO: NO filtrar "info@" ni "contacto@" por local-part — es COMO RESPONDEN los negocios en España
// (bug 02-07: se tragó a info@clinicasaludymas.com y 3 más). Solo no-reply/notificaciones + dominios de plataformas.
const PLATFORM_NOISE = /^(no-?reply|noreply|notifications?|mailer|mailer-daemon)@|@(accounts\.google\.com|google\.com|googlemail\.com|x\.com|mail\.instagram\.com|priority\.instagram\.com|supabase\.com|uber\.com|glovoapp\.com|binance\.com|crypto\.com|netlify\.com|lottiefiles\.com|runpod\.io|resend\.(dev|com)|updates\.resend\.com|practicatest\.com|transactional\.life360\.com)$/i;
const INTERNAL_SUBJECT = /FAROSEED|test colocacion|Faro · parte|Prueba Faro/i;

const state = { generatedAt: new Date().toISOString(), bouncedEmails: [], bouncedPlaceIds: [], replies: [], byAccount: {} };

for (const acc of accounts) {
  process.stdout.write(`\n══════ ${acc.user}\n`);
  let conn;
  try { conn = await imapConnect(acc.user, acc.pass); }
  catch (e) { console.log(`  ✗ no conecta: ${e.message}`); continue; }
  if (!conn.ok) { console.log(`  ✗ LOGIN rechazado (¿app password incorrecta / IMAP off?)`); conn.end(); continue; }

  const sel = await conn.cmd("SELECT INBOX");
  const exists = Number((sel.text.match(/\* (\d+) EXISTS/) || [])[1] || 0);
  console.log(`  Bandeja: ${exists} mensaje(s)`);
  const accSummary = { exists, bounces: [], replies: [] };

  // 1) Rebotes
  const sb = await conn.cmd('SEARCH FROM "mailer-daemon"');
  const bounceIds = parseSearch(sb.text);
  for (const id of bounceIds) {
    const f = await conn.cmd(`FETCH ${id} (BODY.PEEK[TEXT])`);
    const body = f.text;
    let failed = "";
    const m = body.match(/Final-Recipient:\s*rfc822;\s*(\S+@\S+)/i)
      || body.match(/delivered to\s+(?:your message[^\n]*?)?(\S+@\S+)/i)
      || body.match(/to\s+(\S+@\S+?)\s+because/i);
    if (m) failed = m[1].replace(/[<>.,;]+$/, "").toLowerCase();
    if (failed) { accSummary.bounces.push(failed); state.bouncedEmails.push(failed); const pid = emailToPlace.get(failed); if (pid && !state.bouncedPlaceIds.includes(pid)) state.bouncedPlaceIds.push(pid); }
  }
  console.log(`  Rebotes: ${accSummary.bounces.length}${accSummary.bounces.length ? " → " + accSummary.bounces.slice(0, 12).join(", ") + (accSummary.bounces.length > 12 ? " …" : "") : ""}`);

  // 2) Respuestas humanas. DOS búsquedas que se suman (⚠️ bugs cazados por Jordi el 02-07:
  // (a) "category:primary" no existe en Workspace → 0 respuestas visibles; (b) el warmup de
  // Smartlead mete 30-40 emails/día → un tope de "últimos 80" expulsaba respuestas de hace 2+ días):
  //   A. Barrido genérico reciente del INBOX (los que nos escriben están en sent-log → pid).
  //   B. Dirigida: TODOS nuestros asuntos llevan "Google" → subject:google últimos 14 días, sin tope.
  let sh = await conn.cmd('SEARCH X-GM-RAW "in:inbox newer_than:14d -from:mailer-daemon"');
  if (!sh.ok) sh = await conn.cmd('SEARCH NOT FROM "mailer-daemon" NOT FROM "google.com" NOT FROM "googlemail.com"');
  let humanIds = parseSearch(sh.text);
  if (humanIds.length > 300) humanIds = humanIds.slice(-300);
  const st = await conn.cmd('SEARCH X-GM-RAW "in:inbox newer_than:14d subject:google"');
  if (st.ok) humanIds = [...new Set([...humanIds, ...parseSearch(st.text)])];
  // C. Intención de compra en el CUERPO (pilla respuestas SIN "Re:" tipo «Info Derma Calàbria»):
  // palabras en castellano que el warmup (inglés) no usa jamás.
  const si = await conn.cmd('SEARCH X-GM-RAW "in:inbox newer_than:14d (precio OR coste OR presupuesto OR cuanto OR interesa OR informacion OR llamame)"');
  if (si.ok) humanIds = [...new Set([...humanIds, ...parseSearch(si.text)])];
  if (humanIds.length) {
    const fh = await conn.cmd(`FETCH ${humanIds.join(",")} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
    const blocks = fh.text.split(/\* \d+ FETCH/).slice(1);
    for (const blk of blocks) {
      const from = decodeMime(headerField(blk, "From"));
      const subject = decodeMime(headerField(blk, "Subject"));
      const date = headerField(blk, "Date");
      const fromEmail = emailIn(from);
      if (!fromEmail || OUR_ACCOUNTS.has(fromEmail)) continue;                 // nuestras cuentas (seeds, partes)
      if (WARMUP_NOISE.test(fromEmail) || INTERNAL_SUBJECT.test(subject)) continue; // warmup Smartlead / internos
      if (PLATFORM_NOISE.test(fromEmail)) continue;                            // notificaciones de plataformas
      // Lead = nos escribió alguien a quien LE ENVIAMOS (está en sent-log) o el asunto es de
      // NUESTRAS plantillas (tolerante a acentos rotos). Un "RE:" genérico NO basta: el warmup
      // de Smartlead usa cientos de dominios rotativos con asuntos "RE: ..." en inglés.
      const isReplyToUs = /revisi.n r.pida|c.mo aparece|te busqu.|sab.as que|10 minutos|sale.? antes|en google|faro/i.test(subject);
      const pid = emailToPlace.get(fromEmail) || null;
      const rec = { account: acc.user, from, fromEmail, subject, date, placeId: pid, looksLikeLead: !!pid || isReplyToUs };
      accSummary.replies.push(rec);
      if (rec.looksLikeLead) state.replies.push(rec); // al estado solo leads reales (lo consumen classify + seguimientos)
    }
  }
  // 2c) Respuestas a NUESTROS asuntos que hayan caído en NUESTRO spam (pasa: remitentes raros).
  const selSpam = await conn.cmd('SELECT "[Gmail]/Spam"');
  if (selSpam.ok) {
    const ss = await conn.cmd('SEARCH X-GM-RAW "newer_than:14d subject:google"');
    const spamIds = parseSearch(ss.text);
    if (spamIds.length) {
      const fs2 = await conn.cmd(`FETCH ${spamIds.join(",")} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
      for (const blk of fs2.text.split(/\* \d+ FETCH/).slice(1)) {
        const from = decodeMime(headerField(blk, "From"));
        const subject = decodeMime(headerField(blk, "Subject"));
        const date = headerField(blk, "Date");
        const fromEmail = emailIn(from);
        if (!fromEmail || OUR_ACCOUNTS.has(fromEmail) || WARMUP_NOISE.test(fromEmail) || PLATFORM_NOISE.test(fromEmail) || INTERNAL_SUBJECT.test(subject)) continue;
        const pid = emailToPlace.get(fromEmail) || null;
        const rec = { account: acc.user, from, fromEmail, subject, date, placeId: pid, looksLikeLead: true, inSpam: true };
        accSummary.replies.push(rec); state.replies.push(rec);
        console.log(`  ⚠️ EN NUESTRO SPAM: ${fromEmail} «${subject.slice(0, 60)}» — sácalo de spam a mano`);
      }
    }
    await conn.cmd("SELECT INBOX");
  }
  const leads = accSummary.replies.filter((r) => r.looksLikeLead);
  console.log(`  Mensajes humanos: ${accSummary.replies.length}  (posibles leads: ${leads.length})`);
  for (const r of accSummary.replies) console.log(`     ${r.looksLikeLead ? "⭐" : "·"} ${r.fromEmail}  «${r.subject}»  ${r.date}`);

  state.byAccount[acc.user] = accSummary;
  conn.end();
}

// dedupe
state.bouncedEmails = [...new Set(state.bouncedEmails)];
const outPath = resolve(REPO_ROOT, "targets", `inbox-state-${today()}.json`);
writeFileSync(outPath, JSON.stringify(state, null, 2), "utf8");
console.log(`\n──────────`);
console.log(`Rebotes únicos: ${state.bouncedEmails.length}  ·  con place_id mapeado: ${state.bouncedPlaceIds.length}`);
console.log(`Posibles leads (respuestas): ${state.replies.filter((r) => r.looksLikeLead).length}`);
console.log(`→ ${outPath}`);
