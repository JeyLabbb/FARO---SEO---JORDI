// _preview-piloto.mjs — pantalla de revisión del PILOTO. Por cada negocio muestra
// el email EXACTO que saldría (las 3 variantes) + números reales + estado QA +
// enlace a su informe de 4 páginas. Salida: piloto.html (raíz del repo). Sin red.
//   node src/_preview-piloto.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { VARIANTS } from "./lib/email-copy.mjs";

const T = (p) => resolve(REPO_ROOT, "targets", p);
const rows = JSON.parse(readFileSync(T(`envios-HOY-${today()}.json`), "utf8"));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const card = (r) => {
  const f = r.findings || {};
  const qa = r.qa || { pass: true, score: 100, flags: [] };
  const vs = VARIANTS.map((v) => ({ nombre: v.nombre, subject: v.subject(f, r.negocio, r.ciudad), body: v.body(f, r.negocio, r.ciudad) }));
  const comp = f.bestCompetitor ? `${f.bestCompetitor.reviews} · ${esc(f.bestCompetitor.name)}` : "—";
  const flags = qa.flags.map((x) => `<span class="flag ${x.sev}">${esc(x.msg)}</span>`).join(" ");
  const variantsHtml = vs.map((v) => `<div class="variant"><div class="vh">${esc(v.nombre)}</div><div class="subj">${esc(v.subject)}</div><pre>${esc(v.body)}</pre></div>`).join("");
  const hookHtml = (f.hookGeneric || !f.hook)
    ? `<i>Sin gancho propio → el email arranca con el opener normal (limpio, nunca falso).</i>`
    : `“${esc(f.hook)}” <span class="basis">(${esc(f.hookBasis)})</span>`;
  return `<section class="biz ${qa.pass ? "" : "blocked"}">
    <div class="bh">
      <div><h2>${esc(r.negocio)}</h2><div class="meta">${esc(r.ciudad)} · ${esc(r.vertical)} · ${esc(f.category || "—")} · ${r.email ? esc(r.email) : "<i>sin email</i>"}</div></div>
      <div class="qa ${qa.pass ? "ok" : "no"}">${qa.pass ? "QA ✓ " + qa.score : "BLOQUEADO"}</div>
    </div>
    <div class="hook">${hookHtml}</div>
    ${flags ? `<div class="flags">${flags}</div>` : ""}
    <div class="nums">
      <span><b>Reseñas:</b> ${f.reviews} <span class="vs">vs líder ${comp}</span></span>
      <span><b>Velocidad:</b> ${f.speed != null ? f.speed + "/100" : "—"}</span>
      <span><b>Posición media:</b> ${f.avgPos != null ? "≈" + f.avgPos : "fuera"} <span class="vs">(estimada)</span></span>
    </div>
    <div class="variants">${variantsHtml}</div>
    <div class="links"><a href="apps/web/audits/${esc(r.slug)}.html" target="_blank">Ver informe (4 páginas) ↗</a> · <a href="apps/web/audits/${esc(r.slug)}.pdf" target="_blank">PDF ↗</a></div>
  </section>`;
};

const pass = rows.filter((r) => r.qa?.pass).length;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Faro · Piloto de auditorías</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#16151A;--mut:#6A6770;--faint:#9A97A1;--line:#E9E7EC;--red:#DC2330;--green:#1C8A5B;--amber:#C9780A;--bg:#F4F3F6;}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:15px;line-height:1.55}
.wrap{max-width:1040px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:28px;font-weight:800;margin:0}
.top{border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:24px}
.top .d{color:var(--faint);font-size:13px;margin-top:6px}
.biz{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin-bottom:20px}
.biz.blocked{opacity:.62;border-color:var(--red)}
.bh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.biz h2{font-size:19px;margin:0;font-weight:800}
.meta{color:var(--mut);font-size:13px;margin-top:3px}
.qa{font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap}
.qa.ok{background:#E6F4EC;color:var(--green)}.qa.no{background:#FBE6E8;color:var(--red)}
.hook{margin:14px 0 6px;font-size:16px;font-weight:600}
.hook .basis{color:var(--faint);font-weight:400;font-size:12.5px}
.flags{margin:4px 0 8px}.flag{font-size:11.5px;padding:2px 8px;border-radius:6px;margin-right:6px}
.flag.soft{background:#FBF1E0;color:var(--amber)}.flag.hard{background:#FBE6E8;color:var(--red)}
.nums{display:flex;flex-wrap:wrap;gap:18px;font-size:13.5px;background:#FAFAFB;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:8px 0 16px}
.nums .vs{color:var(--faint)}
.variants{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
@media(max-width:820px){.variants{grid-template-columns:1fr}}
.variant{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
.vh{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);font-weight:700}
.subj{font-weight:700;margin:6px 0 8px;font-size:13.5px}
.variant pre{white-space:pre-wrap;font-family:inherit;font-size:13px;color:var(--mut);margin:0;line-height:1.5}
.links{margin-top:14px;font-size:13px}.links a{color:var(--ink);font-weight:600}
.note{background:#fff;border:1px solid var(--line);border-left:3px solid var(--ink);border-radius:10px;padding:14px 16px;color:var(--mut);font-size:13px;margin-top:8px}
</style></head><body><div class="wrap">
<div class="top"><h1>Faro · Piloto de auditorías (modo cold)</h1>
<div class="d">${rows.length} negocios · ${pass} pasan QA · ${rows.length - pass} bloqueados · generado ${today()} · datos: Google Places + PageSpeed + web propia (sin DataForSEO)</div></div>
${rows.map(card).join("")}
<div class="note"><b>Modo cold:</b> reseñas, ficha y velocidad son datos reales y verificables. La <b>posición es estimada</b> (orden de Places, no el Map Pack exacto) — por eso el email lidera con la brecha de reseñas, que el dueño comprueba al instante en su Google. Cuando contesten, hacemos la auditoría fina con DataForSEO.</div>
</div></body></html>`;

const out = resolve(REPO_ROOT, "piloto.html");
writeFileSync(out, html, "utf8");
console.log(`→ ${out}  (${rows.length} negocios, ${pass} QA-ok)`);
