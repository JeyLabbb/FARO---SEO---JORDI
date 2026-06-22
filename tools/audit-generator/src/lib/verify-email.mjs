// verify-email.mjs — verificación de buzón SIN API de pago, usando el puerto 25.
// Paso 1: MX del dominio (¿hay servidor de correo?). Paso 2: sonda SMTP (HELO/MAIL FROM/RCPT TO)
// → si el servidor RECHAZA el RCPT con 5xx, el buzón NO existe (rebotaría). Cachea por email.
//
// Devuelve 'ok' | 'dead' | 'unknown'. SOLO se descarta 'dead'. 'unknown' se MANTIENE
// (catch-all, greylisting o fallo de red → no sobre-filtrar).
// LÍMITES honestos: los dominios "catch-all" aceptan cualquier RCPT (no detectables); algunos
// servidores bloquean la sonda (→ unknown). Reduce mucho los rebotes, no los elimina del todo.
// La nube (GitHub Actions) suele bloquear el 25 → verificamos en LOCAL y la caché (versionada) viaja.
import https from "node:https";
import net from "node:net";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../config.mjs";

const CACHE = resolve(REPO_ROOT, "targets", "email-verify-cache.json");
const cache = existsSync(CACHE) ? (() => { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return {}; } })() : {};
let dirty = false;
export function saveVerifyCache() { if (dirty) { writeFileSync(CACHE, JSON.stringify(cache, null, 2), "utf8"); dirty = false; } }

const HELO = "getjeylabbb.com";          // dominio propio (resuelve)
const PROBE_FROM = "verify@getjeylabbb.com";
// MX por DNS-over-HTTPS (el resolver del sistema/c-ares da ECONNREFUSED en este entorno; DoH va
// por HTTPS/443 que sí funciona). dns.google/resolve devuelve JSON simple, sin cabeceras especiales.
const mxCache = {};
function doh(name, type) {
  return new Promise((res) => {
    https.get(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, (r) => {
      let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => { try { res(JSON.parse(b)); } catch { res(null); } });
    }).on("error", () => res(null));
  });
}
async function mxOf(domain) {
  if (mxCache[domain] !== undefined) return mxCache[domain];
  const j = await doh(domain, "MX");
  let r;
  if (!j) r = undefined;                                                  // no se pudo comprobar (red)
  else if (j.Status === 3) r = null;                                      // NXDOMAIN → dominio inexistente
  else if (!j.Answer || !j.Answer.some((a) => a.type === 15)) r = null;   // sin registro MX
  else r = j.Answer.filter((a) => a.type === 15).map((a) => { const p = a.data.trim().split(/\s+/); return { pri: +p[0], ex: (p[1] || "").replace(/\.$/, "") }; }).sort((a, b) => a.pri - b.pri)[0].ex;
  mxCache[domain] = r; return r; // string=MX · null=sin correo · undefined=no se pudo comprobar
}

function smtpRcpt(mx, email, timeout = 7000) {
  return new Promise((res) => {
    const sock = net.createConnection(25, mx);
    let stage = 0, out = "unknown", buf = "", finished = false;
    const fin = (r) => { if (finished) return; finished = true; out = r; try { sock.write("QUIT\r\n"); } catch {} sock.destroy(); res(r); };
    sock.setTimeout(timeout, () => fin(out));
    sock.on("error", () => fin("unknown"));
    sock.on("data", (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, ""); buf = buf.slice(idx + 1);
        if (!/^\d{3}/.test(line)) continue;
        const code = parseInt(line.slice(0, 3), 10);
        if (line[3] === "-") continue;              // respuesta multilínea: espera la final
        if (stage === 0) { if (code === 220) { sock.write(`HELO ${HELO}\r\n`); stage = 1; } else fin("unknown"); }
        else if (stage === 1) { if (code === 250) { sock.write(`MAIL FROM:<${PROBE_FROM}>\r\n`); stage = 2; } else fin("unknown"); }
        else if (stage === 2) { if (code === 250) { sock.write(`RCPT TO:<${email}>\r\n`); stage = 3; } else fin("unknown"); }
        else if (stage === 3) {
          if (code === 250 || code === 251) fin("ok");
          else if (code >= 500 && code < 560 && /5\.1\.[01]|user unknown|no such (user|mailbox|recipient)|mailbox (unavailable|not found|does ?n.?t exist|is disabled)|recipient (address )?(rejected|unknown)|address (rejected|does not exist)|no (such )?mailbox|invalid (recipient|mailbox|address)|account (is )?disabled|does not exist|user not found/i.test(line)) fin("dead");
          else fin("unknown"); // 5xx genérico (a veces anti-spam por IP residencial) → NO descartar
        }
      }
    });
  });
}

export async function verifyEmail(email) {
  email = String(email || "").toLowerCase().trim();
  if (!email.includes("@")) return "dead";
  if (cache[email]) return cache[email];
  const mx = await mxOf(email.split("@")[1]);
  let verdict;
  if (mx === null) verdict = "dead";          // dominio sin servidor de correo
  else if (mx === undefined) verdict = "unknown"; // no se pudo comprobar el DNS → mantener
  else verdict = await smtpRcpt(mx, email);
  cache[email] = verdict; dirty = true;
  return verdict;
}

// Verifica en paralelo (concurrencia limitada) y guarda la caché. Devuelve {email: verdict}.
export async function verifyMany(emails, conc = 8) {
  const out = {}; let i = 0;
  const worker = async () => { while (i < emails.length) { const e = emails[i++]; out[String(e).toLowerCase().trim()] = await verifyEmail(e); } };
  await Promise.all(Array.from({ length: Math.min(conc, emails.length || 1) }, worker));
  saveVerifyCache();
  return out;
}
