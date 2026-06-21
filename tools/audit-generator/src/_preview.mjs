// _preview.mjs — muestra el EMAIL del nº1 y varios WhatsApp (el más rezagado,
// uno medio y el líder) para revisar el tono antes de enviar.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
import { subject, bodyText, waText } from "./lib/email-copy.mjs";

const j = JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`), "utf8"));
const em = j.filter((r) => r.channel === "email").sort((a, b) => a.priority - b.priority)[0];

if (em) {
  console.log("══════════ EMAIL (nº1) ══════════");
  console.log("ASUNTO: " + subject(em.findings, em.negocio, em.ciudad) + "\n");
  console.log(bodyText(em.findings, em.negocio, em.ciudad));
}

const was = j.filter((r) => r.channel === "whatsapp" && r.findings).sort((a, b) => (a.findings.businessVisibility ?? 50) - (b.findings.businessVisibility ?? 50));
const pick = [...new Set([was[0], was[Math.floor(was.length / 2)], was[was.length - 1]])].filter(Boolean);
for (const w of pick) {
  console.log(`\n══════════ WHATSAPP — ${w.negocio} (${w.ciudad})  [visibilidad ${w.findings.businessVisibility}% vs ${w.findings.competitorVisibility}%] ══════════`);
  console.log(waText(w.findings, w.negocio, w.ciudad));
}
