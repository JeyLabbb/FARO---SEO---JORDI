// refill-stock.mjs — construye STOCK en BUCLE, guardando+subiendo CADA trozo (sobrevive a los
// cortes de sesión: lo ya commiteado nunca se pierde). Cada vuelta: cola-add (un trozo) → pdf-web
// --missing → git add/commit/push. Para al llegar al objetivo de desplegables o si ya no entra nada
// nuevo (fuente agotada / todo duplicado o muerto). Reanudable: cola-add dedup por place_id/email.
//   node src/refill-stock.mjs [--target-deploy 1000] [--chunk 80] [--source <csv>]
//   NECESITA RED → dangerouslyDisableSandbox.  (cwd: tools/audit-generator)
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";

const args = process.argv.slice(2);
const numAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const strAfter = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const TARGET = numAfter("--target-deploy", 1000);
const CHUNK = numAfter("--chunk", 80);
const SOURCE = strAfter("--source", resolve(REPO_ROOT, "targets", "negocios-espana-2026-06-21.csv"));
const CWD = resolve(REPO_ROOT, "tools", "audit-generator");
const sh = (cmd, cwd = CWD) => { try { return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return (e.stdout || "") + (e.stderr || ""); } };
const tail = (s, n = 1) => String(s || "").trim().split("\n").slice(-n).join("\n");

const cola = () => JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", "cola.json"), "utf8"));
const sent = () => JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", "sent-log.json"), "utf8"));
const dirA = resolve(REPO_ROOT, "apps", "web", "audits");
const listoN = () => Object.values(cola().items || {}).filter((i) => i.status === "listo").length;
const deployN = () => { const s = sent(); return Object.values(cola().items || {}).filter((i) => i.status === "listo" && i.email && !s[i.place_id] && existsSync(resolve(dirA, `${i.slug}.pdf`))).length; };

for (let v = 1; v <= 300; v++) {
  const dep0 = deployN(), lis0 = listoN();
  if (dep0 >= TARGET) { console.log(`\n✅ Objetivo: ${dep0} desplegables (>= ${TARGET}). Fin.`); break; }
  console.log(`\n— Vuelta ${v} · desplegables ${dep0} · listos ${lis0} —`);
  console.log("  cola-add: " + tail(sh(`node src/cola-add.mjs "${SOURCE}" --target 100000 --batch ${CHUNK}`), 1));
  console.log("  pdf-web:  " + tail(sh(`node src/pdf-web.mjs --missing`), 1));
  sh(`git add apps/web/audits targets/cola.json targets/mv-verify-cache.json targets/email-verify-cache.json`, REPO_ROOT);
  sh(`git -c user.name=faro-bot -c user.email=faro-bot@users.noreply.github.com commit -q -m "super stock: trozo (vuelta ${v})"`, REPO_ROOT);
  sh(`git pull --rebase -q origin main`, REPO_ROOT);
  sh(`git push -q origin main`, REPO_ROOT);
  const dep1 = deployN(), lis1 = listoN();
  console.log(`  → desplegables ${dep1} (+${dep1 - dep0}) · listos ${lis1} (+${lis1 - lis0}) · guardado y subido`);
  if (lis1 === lis0) { console.log("\n⚠️ No entran nuevos (fuente agotada o todo duplicado/muerto). Fin."); break; }
}
console.log(`\nFIN · desplegables finales: ${deployN()} · listos: ${listoN()}`);
