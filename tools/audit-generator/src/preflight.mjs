// preflight.mjs — GUARDIÁN pre-envío de Faro. Antes de enviar NADA cada mañana,
// comprueba que TODO cuadra. Filosofía (decisión de Jordi): "ante la duda, NO enviar".
// Si algo no tiene sentido, ABORTA el envío del día y deja escrito por qué — jamás
// quema cuentas a ciegas. Lo llama run-daily (import { preflight }); también corre
// suelto para revisar a mano:  node src/preflight.mjs
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, BRAND } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { gmailAccounts } from "./lib/gmail-smtp.mjs";
import { accountReport } from "./lib/caps.mjs";

const TARGETS = resolve(REPO_ROOT, "targets");
const T = (p) => resolve(TARGETS, p);
const J = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };

const VOLUME_CEILING = 200; // tope de cordura: enviar más que esto en un día = algo va mal

export function preflight() {
  const reasons = [];   // cualquiera de estos ABORTA el envío
  const warnings = [];  // se avisan pero no abortan
  const t = today();

  // 1) Configuración mínima de envío
  const accs = gmailAccounts();
  if (!accs.length) reasons.push("No hay cuentas de envío (GMAIL_ACCOUNTS vacío).");

  // 2) Marca correcta — JAMÁS enviar bajo "MTRYX" ni nada que no sea Faro
  if (BRAND !== "Faro") reasons.push(`Marca = "${BRAND}" (se esperaba "Faro"). No se envía bajo marca equivocada.`);

  // 3) Freno manual global
  const freno = existsSync(T("PARAR.flag"));

  // 4) ¿Tenemos datos FRESCOS de rebotes? Si no leímos las bandejas hoy, vamos CIEGOS
  //    a los rebotes → podríamos disparar desde una cuenta tocada. NO enviar a ciegas.
  const sentLog = J(T("sent-log.json"), {});
  const hasHistory = Object.keys(sentLog).length > 0;
  const inboxPath = T(`inbox-state-${t}.json`);
  let bounced = new Set(), inboxOk = false;
  if (existsSync(inboxPath)) {
    const st = J(inboxPath, {});
    bounced = new Set((st.bouncedEmails || []).map((e) => String(e).toLowerCase()));
    const accStates = Object.values(st.byAccount || {});
    inboxOk = accStates.some((a) => typeof a.exists === "number"); // al menos una bandeja leída de verdad
  }
  if (hasHistory && !inboxOk) reasons.push("No se pudieron leer las bandejas hoy (sin datos de rebotes). No se envía a ciegas.");

  // 5) Salud de cuentas (con los rebotes de hoy)
  const rep = accountReport(sentLog, bounced);
  const sending = rep.filter((a) => a.cap > 0);
  const sick = rep.filter((a) => a.state && a.state !== "ok");
  for (const a of sick) warnings.push(`Cuenta ${a.account}: ${a.state} (rebote ${a.bounceRate}%, tope ${a.cap}/día).`);
  if (hasHistory && sending.length === 0) reasons.push("Todas las cuentas están frenadas/congeladas/pausadas. Nada seguro que enviar.");

  // 6) Cordura de volumen: capacidad restante hoy (tope − ya enviado − seguimientos)
  const load = {};
  for (const v of Object.values(sentLog)) if ((v.at || "").slice(0, 10) === t && v.account) load[v.account] = (load[v.account] || 0) + 1;
  for (const v of Object.values(J(T("followup-log.json"), {}))) if ((v.at || "").slice(0, 10) === t && v.account) load[v.account] = (load[v.account] || 0) + 1;
  const remaining = sending.reduce((s, a) => s + Math.max(0, a.cap - (load[a.account] || 0)), 0);
  if (remaining > VOLUME_CEILING) reasons.push(`Capacidad de hoy = ${remaining} (> ${VOLUME_CEILING}). Algo no cuadra; no se envía hasta revisarlo.`);

  // 7) Stock del almacén
  const cola = J(T("cola.json"), { items: {} });
  const deployable = Object.values(cola.items || {}).filter((i) => i.status === "listo" && i.email && !sentLog[i.place_id] && existsSync(resolve(REPO_ROOT, "apps", "web", "audits", `${i.slug}.pdf`))).length;
  if (deployable === 0) warnings.push("Almacén sin stock desplegable (0 informes con PDF y email sin enviar).");
  else if (deployable < remaining) warnings.push(`Stock bajo: ${deployable} desplegables para ~${remaining} de capacidad.`);

  const abort = reasons.length > 0;
  const verdict = { at: new Date().toISOString(), abort, freno, reasons, warnings, capacidadRestante: remaining, cuentasSanas: sending.length, cuentasTocadas: sick.map((a) => ({ account: a.account, state: a.state, bounceRate: a.bounceRate, cap: a.cap })), stockDesplegable: deployable, rebotesConocidos: bounced.size };
  try { writeFileSync(T(`preflight-${t}.json`), JSON.stringify(verdict, null, 2), "utf8"); } catch {}
  return verdict;
}

// Ejecutable suelto para revisar a mano
if (process.argv[1] && /preflight\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const v = preflight();
  console.log(`Preflight ${v.abort ? "⛔ ABORTAR ENVÍO" : "✅ OK PARA ENVIAR"}  ·  capacidad ${v.capacidadRestante}  ·  cuentas sanas ${v.cuentasSanas}  ·  stock ${v.stockDesplegable}  ·  rebotes conocidos ${v.rebotesConocidos}`);
  for (const r of v.reasons) console.log(`  ⛔ ${r}`);
  for (const w of v.warnings) console.log(`  ⚠️ ${w}`);
  process.exit(v.abort ? 1 : 0);
}
