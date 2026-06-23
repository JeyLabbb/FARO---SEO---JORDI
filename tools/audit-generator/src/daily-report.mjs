// daily-report.mjs — PARTE DIARIO por email a Jordi. Decisión de Jordi: SIEMPRE un
// resumen del día + aviso si hay cualquier problema. El asunto ya lleva ✅/⚠️ para
// verlo de un vistazo. Lee el estado que dejan build-stats (stats.json), el guardián
// (preflight-FECHA.json) y run-daily (last-run.json).
//   node src/daily-report.mjs [--dry]    · NECESITA RED salvo --dry → dangerouslyDisableSandbox
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { sendMail, gmailAccounts } from "./lib/gmail-smtp.mjs";

const REPORT_TO = process.env.FARO_REPORT_TO || "yourbusinesstry@gmail.com";
const DRY = process.argv.includes("--dry");
const T = (p) => resolve(REPO_ROOT, "targets", p);
const J = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const t = today();

const stats = J(T("stats.json"), {});
const lastRun = J(T("last-run.json"), {});
const pf = J(T(`preflight-${t}.json`), null);

const problems = [];
if (pf?.abort) problems.push("ENVÍO FRENADO por el guardián: " + (pf.reasons || []).join(" | "));
if (existsSync(T("PARAR.flag"))) problems.push("Freno manual puesto (PARAR.flag) — no se está enviando.");
for (const w of (pf?.warnings || [])) problems.push(w);
for (const c of (stats.cuentasTocadas || [])) problems.push(`Cuenta ${c.account}: ${c.state} (rebote ${c.bounceRate}%).`);
for (const [k, v] of Object.entries(lastRun.pasos || {})) if (String(v).startsWith("ERROR")) problems.push(`Paso "${k}" falló: ${String(v).slice(0, 140)}`);

const hayProblema = problems.length > 0;
const enviadosHoy = stats.enviadosHoy ?? "?";
const subject = `${hayProblema ? "⚠️" : "✅"} Faro ${t} · ${enviadosHoy} enviados${hayProblema ? " · REVISAR" : ""}`;

let body = `Parte diario de Faro · ${t}\n\n`;
body += hayProblema ? ("⚠️ REVISAR:\n" + problems.map((p) => "  • " + p).join("\n") + "\n\n") : "Todo en orden hoy. ✅\n\n";
body += `Enviados hoy: ${enviadosHoy}\n`;
body += `Total contactados: ${stats.contactados ?? "?"}  ·  rebotes: ${stats.rebotes ?? "?"} (${stats.rebotePct ?? "?"})\n`;
body += `Respuestas: ${stats.respuestas ?? "?"}  ·  interesados: ${stats.interesados ?? "?"}\n`;
body += `Almacén: ${stats.stockDesplegable ?? "?"} listos para enviar (~${stats.bufferDias ?? "?"} días de margen)\n\n`;
body += "Cuentas:\n";
for (const a of (stats.cuentas || [])) body += `  ${a.account} — ${a.state === "ok" ? "ok" : String(a.state).toUpperCase()} · tope ${a.cap}/día · rebote ${a.bounceRate}%\n`;
body += `\nPanel completo: https://panel-ops-jeylabbbs-projects.vercel.app (contraseña faro2026)\n`;
body += "\n— Guardián de Faro (automático)\n";

if (DRY) { console.log(`PARA: ${REPORT_TO}\nASUNTO: ${subject}\n\n${body}`); process.exit(0); }
const acc = gmailAccounts()[0];
if (!acc) { console.error("Sin cuenta Gmail para enviar el parte."); process.exit(0); }
try {
  await sendMail({ user: acc.user, pass: acc.pass, fromName: "Guardián Faro", to: REPORT_TO, subject, text: body });
  console.log(`Parte enviado a ${REPORT_TO}: ${subject}`);
} catch (e) { console.error("No se pudo enviar el parte: " + (e.message || e)); }
