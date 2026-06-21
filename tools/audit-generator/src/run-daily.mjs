// run-daily.mjs — ORQUESTA el día completo (lo que ejecutará la nube cada mañana).
// Encadena: leer bandeja → clasificar respuestas → coger del almacén → PDFs →
// seguimientos → emails nuevos → panel. Cada paso es tolerante a fallos (si uno
// peta, sigue con el resto y lo registra).
//
// FRENO DE EMERGENCIA: si existe targets/PARAR.flag, NO se envía nada (pero sí se
// leen respuestas y se actualiza el panel). Bórralo para reanudar.
//   node src/run-daily.mjs              (día normal)
//   node src/run-daily.mjs --no-topup   (sin rellenar el almacén)
// NECESITA RED → dangerouslyDisableSandbox.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";

const CWD = resolve(REPO_ROOT, "tools", "audit-generator");
const STOP = existsSync(resolve(REPO_ROOT, "targets", "PARAR.flag"));
const run = (cmd) => {
  console.log(`\n▶ node ${cmd}`);
  try { execSync(`node ${cmd}`, { cwd: CWD, stdio: "inherit" }); }
  catch (e) { console.error(`  ✗ paso falló (sigo): ${e.message}`); }
};

console.log(`================ Faro · run-daily · ${new Date().toISOString().slice(0, 10)} ${STOP ? "· ⛔ FRENO ACTIVO" : ""} ================`);

// 1) Estado de la bandeja (rebotes + respuestas) y clasificación de respuestas.
run("src/_inbox-check.mjs");
run("src/classify-replies.mjs");

// 2) Armar el lote del día desde el almacén (respeta capacidad de cuentas y dedup).
run("src/cola-day.mjs");

// 3) Enviar (salvo freno).
if (STOP) {
  console.log("\n⛔ Envío saltado por targets/PARAR.flag. Bórralo para reanudar.");
} else {
  run("src/pdf-web.mjs --today");
  run("src/send-followups.mjs --limit 25");
  run("src/send-emails.mjs");
}

// 4) Paneles.
run("src/build-stats.mjs");

console.log(`\n================ Fin del día ================`);
