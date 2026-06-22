// run-daily.mjs — ORQUESTA el día completo (lo que ejecuta la nube cada mañana).
// bandeja → clasificar → coger del almacén → PDFs → seguimientos → emails → panel.
// FRENO: si existe targets/PARAR.flag, NO envía (pero sí prepara todo y actualiza el panel).
// Escribe targets/last-run.json con un resumen verificable (qué pasó en cada paso).
//   node src/run-daily.mjs   ·  NECESITA RED → dangerouslyDisableSandbox.
import { execSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { gmailAccounts } from "./lib/gmail-smtp.mjs";
import { capacity } from "./lib/caps.mjs";

const CWD = resolve(REPO_ROOT, "tools", "audit-generator");
const STOP = existsSync(resolve(REPO_ROOT, "targets", "PARAR.flag"));
const summary = { at: new Date().toISOString(), sha: (process.env.GITHUB_SHA || "local").slice(0, 7), chrome: process.env.CHROME_PATH || "(sin CHROME_PATH)", freno: STOP, pasos: {} };
const run = (name, cmd) => {
  console.log(`\n▶ node ${cmd}`);
  try { const out = execSync(`node ${cmd}`, { cwd: CWD, encoding: "utf8" }); process.stdout.write(out); summary.pasos[name] = "ok · " + (out.trim().split("\n").pop() || "").slice(0, 160); }
  catch (e) { const o = (String(e.stdout || "") + String(e.stderr || "") + (e.message || "")).slice(-220); summary.pasos[name] = "ERROR · " + o; console.error(o); }
};

console.log(`===== Faro · run-daily · ${today()} ${STOP ? "· ⛔ FRENO (no envía)" : ""} =====`);
run("bandeja", "src/_inbox-check.mjs");
run("clasificar", "src/classify-replies.mjs");
run("cola_dia", "src/cola-day.mjs");
// Los PDFs se pre-generan en local y se versionan; la nube NO usa Chrome, solo los adjunta.
if (STOP) console.log("\n⛔ Envío saltado por targets/PARAR.flag.");
else { run("seguimientos", "src/send-followups.mjs --limit 25"); run("emails", "src/send-emails.mjs"); }
run("panel", "src/build-stats.mjs");

// Resumen verificable: cuántos se eligieron y cuántos tienen ya su PDF generado.
try {
  const ev = JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`), "utf8"));
  summary.elegidos = ev.length;
  summary.pdfsListos = ev.filter((r) => existsSync(resolve(REPO_ROOT, "apps", "web", "audits", `${r.slug}.pdf`))).length;
} catch { summary.elegidos = 0; summary.pdfsListos = 0; }
try { summary.cuentas = gmailAccounts().length; summary.capacidad = capacity(JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", "sent-log.json"), "utf8"))); } catch {}
writeFileSync(resolve(REPO_ROOT, "targets", "last-run.json"), JSON.stringify(summary, null, 2));
console.log(`\n===== Fin · elegidos ${summary.elegidos} · PDFs ${summary.pdfsListos} · freno ${STOP} =====`);
