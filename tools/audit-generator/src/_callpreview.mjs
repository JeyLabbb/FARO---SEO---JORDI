// _callpreview.mjs — imprime 2 guiones de llamada (texto plano) tal como salen
// en el dashboard, para revisar el tono. Lee lote-LLAMADAS.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }
const L = readFileSync(resolve(REPO_ROOT, "targets", `lote-LLAMADAS-${today()}.csv`), "utf8").split(/\r?\n/).filter(Boolean);
const h = parseCsv(L[0]); const ix = (n) => h.indexOf(n);
const rows = L.slice(1).map(parseCsv).map((c) => ({ negocio: c[ix("negocio")], ciudad: c[ix("ciudad")], vertical: c[ix("vertical")], reviews: c[ix("reseñas")], nota: c[ix("nota")] }));
const VH = { dental: "dentistas", estetica: "centros de estética", fisioterapia: "fisios", pilates: "estudios de pilates", peluqueria: "peluquerías" };
function callScriptText(r) {
  const vh = VH[r.vertical] || (r.vertical || "tu sector");
  const rv = parseInt(r.reviews, 10), nt = parseFloat(String(r.nota || "").replace(",", "."));
  let proof;
  if (rv && rv < 30) proof = `los que salen por delante tienen muchísimas más reseñas que vosotros (${rv} es muy poco para pelear «${vh} ${r.ciudad}»), y Google usa eso para ordenar quién sale primero`;
  else if (nt && nt < 4.3) proof = `vuestra nota (${r.nota}) está por debajo de la de los que aparecen arriba, y eso frena que Google os suba`;
  else proof = `no estáis saliendo en los primeros puestos cuando alguien busca «${vh} ${r.ciudad}», que es justo donde se reparten las llamadas`;
  return [
    `EL ÁNGULO: la COMPETENCIA les gana en visibilidad y se lleva sus clientes; si no lo trabajan, cada mes pierden más. (No hablar de "una foto/una reseña").`,
    `1) Apertura: "Hola, buenas, ¿hablo con ${r.negocio}? Soy Jordi, soy de aquí. ¿Tienes 30 segundos? No te vendo nada raro."`,
    `2) El gancho (que duela): "He estado mirando los/las ${vh} de ${r.ciudad} en Google y, siéndote sincero, os están comiendo terreno. Cuando alguien busca por la zona, vuestra competencia sale por delante y se lleva esos clientes — ${proof}."`,
    `3) La consecuencia: "Y esto no se queda igual: cada mes que no se trabaja, los de al lado os sacan más distancia. Posicionarse cuesta meses; perder el sitio, semanas."`,
    `4) Cómo lo vendes: "Nosotros os ponemos por delante y os mantenemos ahí cada mes. Os preparé un análisis de 1 página, gratis, con vuestros números y los de la competencia."`,
    `5) El cierre: "¿Te lo paso por WhatsApp o email y lo ves? Y si te encaja, te llamo 5 min y te cuento cómo lo haríamos."`,
  ].join("\n");
}
const a = rows.find((r) => parseInt(r.reviews, 10) < 30) || rows[0];
const b = rows.find((r) => parseInt(r.reviews, 10) >= 30) || rows[1];
for (const r of [a, b].filter(Boolean)) {
  console.log(`\n══════════ GUIÓN — ${r.negocio} (${r.ciudad}) · ${r.vertical} · ${r.reviews} reseñas · nota ${r.nota} ══════════`);
  console.log(callScriptText(r));
}
