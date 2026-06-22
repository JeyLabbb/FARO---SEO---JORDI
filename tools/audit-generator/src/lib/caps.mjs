// caps.mjs — RAMP-UP de envío por cuenta. El tope diario de cada cuenta sube con su
// antigüedad (días desde su primer envío) y se CONGELA si su tasa de rebote supera el
// umbral. Capacidad total del día = suma de topes. Conservador: mejor lento que quemado.
import { gmailAccounts } from "./gmail-smtp.mjs";

const DAY = 86400000;
export const BOUNCE_FREEZE = 0.08; // >8% rebotes → congelar la cuenta
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
  return Object.values(byAcc).map((o) => {
    const days = o.firstAt == null ? 0 : Math.floor((now - o.firstAt) / DAY);
    const base = WARMED.has(o.account) ? warmedCap(days) : rampCap(days);
    // Tasa de rebote RECIENTE (últimos 30 envíos): los rebotes viejos no penalizan para siempre.
    // Y si va alta, RALENTIZAMOS (no a 0) para que pueda sanear sola con envíos limpios; solo paramos
    // del todo si es catastrófica (>30%), que ya requiere mirarla a mano.
    const recent = o.ev.sort((a, b) => b.t - a.t).slice(0, 30);
    const recRate = recent.length ? recent.filter((e) => e.b).length / recent.length : 0;
    let cap = base, state = "ok";
    if (recent.length >= 15 && recRate > 0.30) { cap = 0; state = "frozen"; }
    else if (recent.length >= 15 && recRate > BOUNCE_FREEZE) { cap = Math.max(5, Math.floor(base / 3)); state = "throttled"; }
    return { account: o.account, sends: o.sends, firstAt: o.firstAt, bounces: o.bounces, days, bounceRate: Math.round(recRate * 1000) / 10, frozen: cap === 0, state, cap };
  });
}

// Capacidad total del día = suma de topes de todas las cuentas sanas.
export function capacity(sentLog = {}, bouncedEmails = new Set()) {
  return accountReport(sentLog, bouncedEmails).reduce((s, a) => s + a.cap, 0);
}
