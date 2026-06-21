// panel-log-activity.mjs — apunta TRABAJO REAL en la ficha de un cliente.
// Esto alimenta el feed "En qué estoy trabajando" del panel con cosas que
// SÍ has hecho (honestidad: nada de trabajo inventado a un cliente que paga).
// El día de mañana, el "bot de SEO" puede llamar a esto mismo para reportar.
//
//   node src/panel-log-activity.mjs <slug> <tipo> "<texto>"
//   tipo = reseñas | post | fotos | web | ficha
//   ej:  node src/panel-log-activity.mjs pagadi reseñas "Pedidas reseñas a 12 clientes por WhatsApp"
//
// NECESITA RED → dangerouslyDisableSandbox.

import { rest } from "./lib/panel.mjs";

const KINDS = ["reseñas", "post", "fotos", "web", "ficha"];
const [slug, kind, ...rest_] = process.argv.slice(2);
const body = rest_.join(" ").trim();

if (!slug || !kind || !body) {
  console.error('Uso: node src/panel-log-activity.mjs <slug> <tipo> "<texto>"');
  console.error("tipo = " + KINDS.join(" | "));
  process.exit(1);
}
if (!KINDS.includes(kind)) {
  console.error(`Tipo "${kind}" no válido. Usa: ${KINDS.join(" | ")}`);
  process.exit(1);
}

const [client] = await rest("GET", `clients?slug=eq.${encodeURIComponent(slug)}&select=id,name`);
if (!client) { console.error(`No hay cliente con slug "${slug}".`); process.exit(1); }

await rest("POST", "activity", { prefer: "return=minimal", body: [{ client_id: client.id, kind, body }] });
console.log(`✓ Apuntado en ${client.name}: [${kind}] ${body}`);
