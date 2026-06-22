// caps.mjs — RAMP-UP de envío por cuenta. El tope diario de cada cuenta sube con su
// antigüedad (días desde su primer envío) y se CONGELA si su tasa de rebote supera el
// umbral. Capacidad total del día = suma de topes. Conservador: mejor lento que quemado.
import { gmailAccounts } from "./gmail-smtp.mjs";

const DAY = 86400000;
export const BOUNCE_FREEZE = 0.08; // >8% rebotes → congelar la cuenta
// Cuentas ya calentadas (p.ej. en Smartlead): arrancan POR ENCIMA de una nueva del todo,
// pero igual suben poco a poco (no a saco) y se vigilan por rebotes como las demás.
const WARMED = new Set(["jordi@tryjeylabbb.com", "jordi@getjeylabbb.com"]);
const WARMUP_BONUS = 8; // días "de ventaja" → empiezan ~13/día y van subiendo

// Tope diario por antigüedad (Gmail gratis en frío). Conservador y por escalones:
// arranca bajo, se acerca al nivel ya probado (~13/cuenta) y sube despacio. Techo 20.
// El de verdad protege la entregabilidad es la congelación por rebotes (>8%).
export function rampCap(daysActive) {
  if (daysActive < 5) return 10;
  if (daysActive < 12) return 13;
  if (daysActive < 30) return 16;
  return 20;
}

// Informe por cuenta a partir del sent-log (+ set de emails rebotados, opcional).
export function accountReport(sentLog = {}, bouncedEmails = new Set()) {
  const now = Date.now();
  const byAcc = {};
  for (const v of Object.values(sentLog)) {
    const a = v.account || "?";
    const t = Date.parse(v.at);
    const o = (byAcc[a] = byAcc[a] || { account: a, sends: 0, firstAt: null, bounces: 0 });
    o.sends++;
    if (!isNaN(t)) o.firstAt = o.firstAt == null ? t : Math.min(o.firstAt, t);
    if (v.to && bouncedEmails.has(String(v.to).toLowerCase())) o.bounces++;
  }
  // incluir cuentas configuradas aunque aún no hayan enviado (empiezan en el escalón 1)
  for (const acc of gmailAccounts()) if (!byAcc[acc.user]) byAcc[acc.user] = { account: acc.user, sends: 0, firstAt: null, bounces: 0 };
  return Object.values(byAcc).map((o) => {
    const days = (o.firstAt == null ? 0 : Math.floor((now - o.firstAt) / DAY)) + (WARMED.has(o.account) ? WARMUP_BONUS : 0);
    const bounceRate = o.sends ? o.bounces / o.sends : 0;
    const frozen = bounceRate > BOUNCE_FREEZE;
    const cap = frozen ? 0 : rampCap(days);
    return { ...o, days, bounceRate: Math.round(bounceRate * 1000) / 10, frozen, cap };
  });
}

// Capacidad total del día = suma de topes de todas las cuentas sanas.
export function capacity(sentLog = {}, bouncedEmails = new Set()) {
  return accountReport(sentLog, bouncedEmails).reduce((s, a) => s + a.cap, 0);
}
