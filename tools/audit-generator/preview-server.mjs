// preview-server.mjs — mini-servidor estático (sin dependencias) para previsualizar
// el último audit HTML generado. Lo usa Claude Preview (.claude/launch.json).
import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "audits");
const DASHBOARD = join(HERE, "..", "..", "dashboard.html");
const PANEL = join(HERE, "..", "..", "panel-cliente.html");
const PORT = process.env.PORT || 4599;

function newestHtml() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({ f, t: statSync(join(DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0] ? join(DIR, files[0].f) : null;
}

createServer((req, res) => {
  // Sirve cualquier .html de la raíz del repo por su ruta (informes, etc.).
  if (req.url && req.url.split("?")[0].endsWith(".html")) {
    const f = join(HERE, "..", "..", req.url.split("?")[0].replace(/^\/+/, ""));
    if (existsSync(f)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(readFileSync(f, "utf8"));
      return;
    }
  }
  if (req.url && (req.url.includes("cliente") || req.url.includes("panel")) && existsSync(PANEL)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(PANEL, "utf8"));
    return;
  }
  if (req.url && req.url.includes("dashboard") && existsSync(DASHBOARD)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(DASHBOARD, "utf8"));
    return;
  }
  const file = newestHtml();
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No hay audits HTML generados todavía.");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(file, "utf8"));
}).listen(PORT, () => console.log(`Preview del audit en http://localhost:${PORT}`));
