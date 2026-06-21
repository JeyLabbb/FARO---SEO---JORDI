// topdf.mjs — convierte los audits .html en .pdf usando el Chrome/Edge ya
// instalado (sin dependencias). Uso: node src/topdf.mjs  (todos)  o  node src/topdf.mjs archivo.html
import { readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { ROOT } from "./config.mjs";

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error("No encuentro Chrome ni Edge. Imprime a PDF manualmente (Ctrl+P).");
  process.exit(1);
}
console.log("Navegador:", browser.split("/").pop());

const dir = resolve(ROOT, "audits");
const profile = resolve(ROOT, ".pdf-profile");
const args = process.argv.slice(2);
const files = args.length
  ? args
  : readdirSync(dir).filter((f) => f.endsWith(".html"));

let ok = 0;
for (const f of files) {
  const inPath = resolve(dir, f);
  const outPath = inPath.replace(/\.html$/i, ".pdf");
  try {
    execFileSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=6000",
        `--user-data-dir=${profile}`,
        `--print-to-pdf=${outPath}`,
        `file:///${inPath.replace(/\\/g, "/")}`,
      ],
      { stdio: "ignore", timeout: 90000 }
    );
    console.log("  PDF ✓", f.replace(/\.html$/i, ".pdf"));
    ok++;
  } catch (e) {
    console.log("  PDF ✗", f, "-", e.message);
  }
}
console.log(`\nHecho: ${ok}/${files.length} PDFs en ${dir}`);
