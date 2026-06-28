// pdf-web.mjs — convierte los audits .html de apps/web/audits/ en .pdf (mismo
// sitio), con Chrome/Edge headless, EN PARALELO (varios a la vez = rápido).
//   node src/pdf-web.mjs  (todos) · --missing (solo los que no tienen PDF) · --today · slug.html
// NECESITA RED (fuentes) → dangerouslyDisableSandbox.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";

const BROWSERS = [
  process.env.CHROME_PATH, process.env.CHROME_BIN, process.env.PUPPETEER_EXECUTABLE_PATH, // nube / Linux
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium",
].filter(Boolean);
const browser = BROWSERS.find((p) => { try { return existsSync(p); } catch { return false; } });
if (!browser) { console.error("No encuentro Chrome ni Edge."); process.exit(1); }
console.log("Navegador:", browser.split("/").pop());

const dir = resolve(REPO_ROOT, "apps", "web", "audits");
const profBase = resolve(REPO_ROOT, "tools", "audit-generator", ".pdf-profile");
const args = process.argv.slice(2);
let files;
if (args.includes("--today")) {
  // Solo los audits del lote de HOY (lee envios-HOY-FECHA.json) → no toca los viejos.
  const jp = resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`);
  const recs = JSON.parse(readFileSync(jp, "utf8"));
  files = [...new Set(recs.map((r) => `${r.slug}.html`))].filter((f) => existsSync(resolve(dir, f)));
  console.log(`Modo --today: ${files.length} audits del lote de hoy.`);
} else {
  const named = args.filter((a) => !a.startsWith("--"));
  files = named.length ? named : readdirSync(dir).filter((f) => f.endsWith(".html"));
  // --missing: solo los audits que aún NO tienen su PDF (no regenera los ~700 ya hechos).
  if (args.includes("--missing")) { files = files.filter((f) => !existsSync(resolve(dir, f.replace(/\.html$/i, ".pdf")))); console.log(`Modo --missing: ${files.length} audits sin PDF.`); }
}

let firstErr = "";
function toPdf(f, i) {
  return new Promise((res) => {
    const inPath = resolve(dir, f);
    const outPath = inPath.replace(/\.html$/i, ".pdf");
    execFile(browser, [
      "--headless=old", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw", "--virtual-time-budget=8000",
      `--user-data-dir=${profBase}_${i % 4}`,
      `--print-to-pdf=${outPath}`,
      inPath.startsWith("/") ? `file://${inPath}` : `file:///${inPath.replace(/\\/g, "/")}`,
    ], { timeout: 90000 }, (err, _o, stderr) => {
      if (!err && existsSync(outPath)) { console.log("  PDF ✓", f.replace(/\.html$/i, ".pdf")); res(true); }
      else { if (!firstErr) firstErr = err ? String(err.message) : "exit 0 sin fichero · " + String(stderr || "").slice(-120); console.log("  PDF ✗", f); res(false); }
    });
  });
}

async function mapLimit(items, limit, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } })); return out; }

const results = await mapLimit(files, 4, toPdf);
const ok = results.filter(Boolean).length;
console.log(`\nHecho: ${ok}/${files.length} PDFs en apps/web/audits/${ok < files.length && firstErr ? " · 1er fallo: " + firstErr.slice(0, 150) : ""}`);
