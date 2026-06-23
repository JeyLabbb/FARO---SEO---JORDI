// caps.mjs — RAMP-UP de envío por cuenta. El tope diario de cada cuenta sube con su
// antigüedad (días desde su primer envío) y se CONGELA si su tasa de rebote supera el
// umbral. Capacidad total del día = suma de topes. Conservador: mejor lento que quemado.
import { gmailAccounts } from "./gmail-smtp.mjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../config.mjs";

const DAY = 86400000;
// Umbrales de rebote (estándar de industria: <2% bien · 2-5% aceptable · >5% problema · >10% daña reputación).
// Conservador a propósito: mejor frenar una cuenta que quemarla.
export const BOUNCE_THROTTLE = 0.05; // >5% rebote reciente → ralentizar
export const BOUNCE_CRITICAL = 0.10; // >10% → goteo mínimo (NO 0: así la cuenta se sana sola enviando limpio)

// Freno MANUAL por-cuenta (el global es targets/PARAR.flag). Los emails que estén en
// targets/cuentas-pausadas.json NO envían (tope 0, estado "paused"). Reactivar = quitarlos.
export function pausedAccounts() {
  try {
    const p = resolve(REPO_ROOT, "targets", "cuentas-pausadas.json");
    if (!existsSync(p)) return new Set();
    const arr = JSON.parse(readFileSync(p, "utf8"));
    return new Set((Array.isArray(arr) ? arr : []).map((e) => String(e).toLowerCase()));
  } catch { return new Set(); }
}

// Cuentas detectadas EN SPAM por el monitor de colocación (spam-check.mjs → spam-state.json).
// Si una cuenta cayó en spam en el último test, NO envía (cap 0) hasta que vuelva a bandeja.
export function spamAccounts() {
  try {
    const p = resolve(REPO_ROOT, "targets", "spam-state.json");
    if (!existsSync(p)) return new Set();
    const st = JSON.parse(readFileSync(p, "utf8"));
    return new Set(Object.entries(st.byAccount || {}).filter(([, o]) => o && o.placement === "spam").map(([a]) => a.toLowerCase()));
  } catch { return new Set(); }
}
// Cuentas calentadas en Smartlead (reputación ya construida): arrancan ALTO (28) y suben a 40→50/día.
// Calentar NO es licencia para cientos (pasarse = baneo igual); ~50/buzón es el techo agresivo-pero-sano
// en frío. El límite REAL se verifica con los rebotes (freeze a >8%) y con la calidad de la lista.
const WARMED = new Set(["jordi@tryjeylabbb.com", "jordi@getjeylabbb.com"]);

// Tope diario por antigüedad (Gmail gratis en frío). Conservador y por escalones:
// arranca bajo, se acerca al nivel ya probado (~13/cuenta) y sube despacio. Techo 20.
// El de verdad protege la entregabilidad es la congelación por rebotes (>8%).
export function rampCap(daysActive) {          // Gmail gratis (3 antiguas): conservador
  if (daysActive < 5) return 10;
  if (daysActive < 12) return 13;
  if (daysActive < 30) return 16;
  return 22;
}
export function warmedCap(daysActive) {         // Workspace calentada en Smartlead: arranca alto, techo ~50
  if (daysActive < 7) return 28;
  if (daysActive < 21) return 40;
  return 50;
}

// Informe por cuenta a partir del sent-log (+ set de emails rebotados, opcional).
export function accountReport(sentLog = {}, bouncedEmails = new Set()) {
  const now = Date.now();
  const byAcc = {};
  for (const v of Object.values(sentLog)) {
    const a = v.account || "?";
    const t = Date.parse(v.at);
    const o = (byAcc[a] = byAcc[a] || { account: a, sends: 0, firstAt: null, bounces: 0, ev: [] });
    o.sends++;
    if (!isNaN(t)) o.firstAt = o.firstAt == null ? t : Math.min(o.firstAt, t);
    const bounced = !!(v.to && bouncedEmails.has(String(v.to).toLowerCase()));
    if (bounced) o.bounces++;
    o.ev.push({ t: isNaN(t) ? 0 : t, b: bounced });
  }
  // incluir cuentas configuradas aunque aún no hayan enviado (empiezan en el escalón 1)
  for (const acc of gmailAccounts()) if (!byAcc[acc.user]) byAcc[acc.user] = { account: acc.user, sends: 0, firstAt: null, bounces: 0, ev: [] };
  const paused = pausedAccounts();
  const spam = spamAccounts();
  return Object.values(byAcc).map((o) => {
    const days = o.firstAt == null ? 0 : Math.floor((now - o.firstAt) / DAY);
    const base = WARMED.has(o.account) ? warmedCap(days) : rampCap(days);
    // Tasa de rebote RECIENTE (últimos 30 envíos): los rebotes viejos no penalizan para siempre.
    // Y si va alta, RALENTIZAMOS (no a 0) para que pueda sanear sola con envíos limpios; solo paramos
    // del todo si es catastrófica (>30%), que ya requiere mirarla a mano.
    const recent = o.ev.sort((a, b) => b.t - a.t).slice(0, 30);
    const recRate = recent.length ? recent.filter((e) => e.b).length / recent.length : 0;
    let cap = base, state = "ok";
    if (recent.length >= 12 && recRate > BOUNCE_CRITICAL) { cap = 2; state = "throttled"; }                                     // >10% → goteo (se sana solo enviando limpio)
    else if (recent.length >= 12 && recRate > BOUNCE_THROTTLE) { cap = Math.max(3, Math.floor(base / 4)); state = "throttled"; } // >5% → ralentizar
    if (spam.has(o.account.toLowerCase())) { cap = 0; state = "spam"; }      // en spam (seed test) → parar (se reintenta a diario)
    if (paused.has(o.account.toLowerCase())) { cap = 0; state = "paused"; }  // freno manual (override final)
    return { account: o.account, sends: o.sends, firstAt: o.firstAt, bounces: o.bounces, days, bounceRate: Math.round(recRate * 1000) / 10, frozen: cap === 0, state, cap };
  });
}

// Capacidad total del día = suma de topes de todas las cuentas sanas.
export function capacity(sentLog = {}, bouncedEmails = new Set()) {
  return accountReport(sentLog, bouncedEmails).reduce((s, a) => s + a.cap, 0);
}
