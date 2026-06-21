// gmail-smtp.mjs — envío de email vía Gmail SMTP (smtp.gmail.com:465, TLS) con
// "contraseña de aplicación". SIN dependencias (SMTP a mano sobre node:tls).
// Soporta adjuntos (PDF). Lo usa send-batch.mjs.
import tls from "node:tls";
import { readFileSync } from "node:fs";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const wrap = (s) => s.replace(/(.{1,76})/g, "$1\r\n");
let BCOUNT = 0;

function buildMime({ user, fromName, to, subject, text, attachments }) {
  const boundary = `Faro_${Date.now()}_${BCOUNT++}`;
  let m = "";
  m += `From: ${fromName ? `=?UTF-8?B?${b64(fromName)}?= ` : ""}<${user}>\r\n`;
  m += `To: <${to}>\r\n`;
  m += `Subject: =?UTF-8?B?${b64(subject)}?=\r\n`;
  m += `MIME-Version: 1.0\r\n`;
  m += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  m += `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  m += wrap(b64(text));
  for (const att of attachments || []) {
    m += `--${boundary}\r\n`;
    m += `Content-Type: ${att.type || "application/pdf"}; name="${att.filename}"\r\n`;
    m += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
    m += `Content-Transfer-Encoding: base64\r\n\r\n`;
    m += wrap(readFileSync(att.path).toString("base64"));
  }
  m += `--${boundary}--\r\n`;
  return m.replace(/\r\n\./g, "\r\n..");
}

/** Envía un email. pass = contraseña de aplicación (sin espacios). */
export function sendMail({ user, pass, fromName, to, subject, text, attachments }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, "smtp.gmail.com", { servername: "smtp.gmail.com" });
    socket.setEncoding("utf8");
    socket.setTimeout(40000, () => { socket.destroy(); reject(new Error("timeout SMTP")); });
    let buf = "", resolver = null; const replies = [];
    socket.on("data", (d) => {
      buf += d;
      for (const ln of buf.split("\r\n")) {
        if (/^\d{3} /.test(ln)) {
          const reply = { code: +ln.slice(0, 3), text: buf.trim() }; buf = "";
          if (resolver) { const r = resolver; resolver = null; r(reply); } else replies.push(reply);
          break;
        }
      }
    });
    socket.on("error", reject);
    const wait = () => new Promise((res) => { if (replies.length) res(replies.shift()); else resolver = res; });
    const need = (r, exp) => { if (![].concat(exp).includes(r.code)) throw new Error(`SMTP ${r.code}: ${r.text}`); };
    (async () => {
      try {
        need(await wait(), 220);
        socket.write("EHLO faro\r\n"); need(await wait(), 250);
        socket.write("AUTH LOGIN\r\n"); need(await wait(), 334);
        socket.write(`${b64(user)}\r\n`); need(await wait(), 334);
        socket.write(`${b64(pass)}\r\n`); need(await wait(), 235);
        socket.write(`MAIL FROM:<${user}>\r\n`); need(await wait(), 250);
        socket.write(`RCPT TO:<${to}>\r\n`); need(await wait(), [250, 251]);
        socket.write("DATA\r\n"); need(await wait(), 354);
        socket.write(buildMime({ user, fromName, to, subject, text, attachments }) + "\r\n.\r\n");
        need(await wait(), 250);
        socket.write("QUIT\r\n"); socket.end();
        resolve(true);
      } catch (e) { socket.destroy(); reject(e); }
    })();
  });
}

/** Lee las cuentas de GMAIL_ACCOUNTS ("email:pass,email:pass"). */
export function gmailAccounts() {
  return (process.env.GMAIL_ACCOUNTS || "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((pair) => { const i = pair.indexOf(":"); return { user: pair.slice(0, i), pass: pair.slice(i + 1).replace(/\s+/g, "") }; });
}
