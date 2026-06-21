// _clean-audits.mjs — deja en apps/web/audits SOLO los audits del lote de HOY
// (los de velocidad real). Borra el resto (HTML+PDF) — son artefactos
// regenerables; quita la contaminación del lote viejo "--fast" (omitido).
//   node src/_clean-audits.mjs
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";

const dir = resolve(REPO_ROOT, "apps", "web", "audits");
const j = JSON.parse(readFileSync(resolve(REPO_ROOT, "targets", `envios-HOY-${today()}.json`), "utf8"));
const keep = new Set(j.map((r) => r.slug));

let del = 0, kept = 0;
for (const f of readdirSync(dir)) {
  if (!/\.(html|pdf)$/i.test(f)) continue;
  const slug = f.replace(/\.(html|pdf)$/i, "");
  if (keep.has(slug)) { kept++; continue; }
  rmSync(resolve(dir, f));
  del++;
}
console.log(`Limpieza: borrados ${del} ficheros · conservados ${kept} (los ${keep.size} audits de hoy en HTML+PDF).`);
