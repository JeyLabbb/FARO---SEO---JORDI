// audits-index.mjs — genera un índice navegable de TODOS los informes (PDF + HTML)
// en apps/web/audits/index.html: buscador + lista con botones "Ver PDF / Ver informe".
// Enlaces relativos → funciona abriéndolo en local Y si se publica en faroseo.
//   node src/audits-index.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";

const dir = resolve(REPO_ROOT, "apps", "web", "audits");
const cola = (() => { try { return JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", "cola.json"), "utf8")); } catch { return { items: {} }; } })();
const meta = {}; for (const it of Object.values(cola.items || {})) meta[it.slug] = it;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const slugs = readdirSync(dir).filter((f) => f.endsWith(".pdf")).map((f) => f.replace(/\.pdf$/i, ""));
const rows = slugs.map((slug) => {
  const m = meta[slug] || {};
  return { slug, negocio: m.negocio || slug, ciudad: m.ciudad || "", vertical: m.vertical || "", email: m.email || "", html: existsSync(resolve(dir, `${slug}.html`)) };
}).sort((a, b) => a.negocio.localeCompare(b.negocio));

const trs = rows.map((r) => `<tr data-s="${esc((r.negocio + " " + r.ciudad + " " + r.vertical + " " + r.email).toLowerCase())}">
  <td class="b">${esc(r.negocio)}<div class="sub">${esc(r.ciudad)}${r.email ? " · " + esc(r.email) : ""}</div></td>
  <td>${esc(r.vertical)}</td>
  <td class="r"><a class="btn" href="${esc(r.slug)}.pdf" target="_blank">PDF</a>${r.html ? ` <a class="btn ghost" href="${esc(r.slug)}.html" target="_blank">Informe</a>` : ""}</td>
</tr>`).join("");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Faro · Informes (${rows.length})</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#16151A;--mut:#6A6770;--faint:#9A97A1;--line:#E9E7EC;--pine:#155E47;--bg:#F3F4F6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:15px}
.wrap{max-width:880px;margin:0 auto;padding:30px 22px 70px}
h1{font-size:24px;font-weight:800;margin:0}.d{color:var(--faint);font-size:13px;margin:4px 0 18px}
.sbox{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;font-size:15px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);text-align:left;padding:11px 14px;border-bottom:1px solid var(--line)}
td{padding:11px 14px;border-bottom:1px solid var(--line);font-size:14px}tr:last-child td{border-bottom:none}
td.b{font-weight:600}.sub{color:var(--faint);font-size:12px;font-weight:400}td.r,th.r{text-align:right;white-space:nowrap}
.btn{display:inline-block;font-size:12.5px;font-weight:700;text-decoration:none;padding:5px 12px;border-radius:8px;background:var(--pine);color:#fff}
.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
</style></head><body><div class="wrap">
<h1>Faro · Informes generados</h1><div class="d"><b id="n">${rows.length}</b> informes · busca por negocio, ciudad o vertical</div>
<input class="sbox" placeholder="Buscar…" oninput="let c=0;for(const r of document.querySelectorAll('tbody tr')){const v=r.dataset.s.includes(this.value.toLowerCase());r.style.display=v?'':'none';if(v)c++}document.getElementById('n').textContent=c">
<table><thead><tr><th>Negocio</th><th>Vertical</th><th class="r">Abrir</th></tr></thead><tbody>${trs}</tbody></table>
</div></body></html>`;

writeFileSync(resolve(dir, "index.html"), html, "utf8");
console.log(`Índice → ${resolve(dir, "index.html")} (${rows.length} informes)`);
