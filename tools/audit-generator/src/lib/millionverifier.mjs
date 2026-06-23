// millionverifier.mjs — verificación de email con MillionVerifier (API de pago, precisa).
// Complementa al verificador gratis (verify-email.mjs): si NO hay MILLIONVERIFIER_API_KEY
// cae al gratis automáticamente. Cachea por email para no gastar créditos dos veces.
// API single: GET https://api.millionverifier.com/api/v3/?api=KEY&email=X&timeout=15
//   result ∈ ok | catch_all | unknown | disposable | invalid | error | unverified
//   (catch_all y unknown NO consumen crédito; solo ok/invalid/disposable)
import https from "node:https";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../config.mjs";
import { verifyEmail as verifyFree } from "./verify-email.mjs";

const KEY = process.env.MILLIONVERIFIER_API_KEY || "";
export const HAS_MV = Boolean(KEY);

const CACHE = resolve(REPO_ROOT, "targets", "mv-verify-cache.json");
const cache = existsSync(CACHE) ? (() => { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return {}; } })() : {};
let dirty = false;
export function saveMvCache() { if (dirty) { writeFileSync(CACHE, JSON.stringify(cache, null, 2), "utf8"); dirty = false; } }

function callApi(email) {
  return new Promise((res) => {
    const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(KEY)}&email=${encodeURIComponent(email)}&timeout=15`;
    https.get(url, (r) => { let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => { try { res(JSON.parse(b)); } catch { res(null); } }); }).on("error", () => res(null));
  });
}

// Mapea el "result" de MillionVerifier a nuestro veredicto: ok | dead | unknown.
// dead = se descarta (no enviar). unknown = se mantiene (no podemos confirmar; catch-all/greylisting).
function mapResult(result) {
  switch (String(result || "").toLowerCase()) {
    case "ok": return "ok";
    case "invalid": case "disposable": return "dead";
    default: return "unknown"; // catch_all, unknown, error, unverified, "" → no descartar
  }
}

/** Verifica un email. Devuelve {verdict, result, credits}. Sin key → cae al verificador gratis. */
export async function mvVerify(email) {
  email = String(email || "").toLowerCase().trim();
  if (!email.includes("@")) return { verdict: "dead", result: "invalid", credits: null };
  if (cache[email]) return cache[email];
  if (!KEY) { const v = await verifyFree(email); return { verdict: v, result: "free:" + v, credits: null }; }
  const j = await callApi(email);
  const o = (!j || j.error)
    ? { verdict: "unknown", result: j && j.error ? "error" : "no-response", credits: (j && j.credits) ?? null }
    : { verdict: mapResult(j.result), result: j.result, credits: j.credits ?? null };
  cache[email] = o; dirty = true;
  return o;
}

/** Verifica muchos en paralelo (concurrencia limitada) y guarda la caché. → {email: {verdict,result,credits}} */
export async function mvVerifyMany(emails, conc = 5) {
  const out = {}; let i = 0;
  const worker = async () => { while (i < emails.length) { const e = emails[i++]; out[String(e).toLowerCase().trim()] = await mvVerify(e); } };
  await Promise.all(Array.from({ length: Math.min(conc, emails.length || 1) }, worker));
  saveMvCache();
  return out;
}

// Prueba rápida:  node src/lib/millionverifier.mjs  email1 email2 …
if (process.argv[1] && /millionverifier\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const emails = process.argv.slice(2);
  if (!emails.length) { console.log(`HAS_MV=${HAS_MV}. Uso: node src/lib/millionverifier.mjs <email> [email…]`); process.exit(0); }
  const r = await mvVerifyMany(emails);
  for (const [e, v] of Object.entries(r)) console.log(`${e.padEnd(38)} → ${v.verdict.padEnd(8)} (${v.result})  créditos restantes: ${v.credits ?? "?"}`);
}
