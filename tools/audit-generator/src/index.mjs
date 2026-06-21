#!/usr/bin/env node
// index.mjs — CLI del generador de auditorías.
//
// Uso:
//   npm run demo                          -> informe de ejemplo (sin API key)
//   npm run audit -- examples/auraa.json  -> desde un brief JSON
//   npm run audit -- --name "Fisio X" --city Pamplona --searches "fisio Pamplona,fisioterapia deportiva Pamplona"
//
// Flags:
//   --demo                 datos de ejemplo, sin llamar a ninguna API
//   --name <txt>           nombre del negocio (tal y como sale en su ficha)
//   --city <txt>           ciudad/zona (def. Pamplona)
//   --searches "a,b,c"     1-3 búsquedas objetivo (separadas por coma)
//   --competitors "x,y"    competidores explícitos (si no, se auto-detectan)
//   --website <url>        web del cliente (si no, se coge de su ficha)
//   --place-id <id>        place id de Google (salta la búsqueda por nombre)
//   --out <dir>            carpeta de salida (def. audits/)
//   --no-html              no generar el HTML
//   --json                 volcar también el JSON crudo

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { ROOT, HAS_API_KEY } from "./config.mjs";
import { buildAudit } from "./lib/audit.mjs";
import { renderMarkdown, renderHtml } from "./lib/render.mjs";
import { mockAudit } from "./mock.mjs";
import { slugify, today } from "./lib/slug.mjs";

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true; // flag booleana
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function briefFromFlags(flags) {
  const split = (v) =>
    typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    name: flags.name,
    city: flags.city || "Pamplona",
    placeId: flags["place-id"] || undefined,
    website: flags.website || undefined,
    searches: split(flags.searches),
    competitors: split(flags.competitors),
  };
}

function loadBrief(path) {
  const full = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const raw = readFileSync(full, "utf8");
  return JSON.parse(raw);
}

function consoleSummary(a) {
  const line = (s) => process.stdout.write(s + "\n");
  line("");
  line(`  ${a.business.name}  ·  ${a.gbp.reviews} reseñas · ${a.gbp.rating ?? "—"}⭐`);
  line(`  ──────────────────────────────────────────────`);
  for (const p of a.positions) {
    const c = p.competitors.map((x) => (x.pos == null ? "—" : x.pos)).join("/");
    line(`  "${p.query}"  →  tú ≈ ${p.business ?? "—"}  (comp: ${c})`);
  }
  line(`  ──────────────────────────────────────────────`);
  line(`  Quick wins:`);
  a.quickWins.forEach((q, i) => line(`   ${i + 1}. ${q.title}`));
  line("");
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  // 1) Conseguir la auditoría (demo o real).
  let audit;
  if (flags.demo) {
    audit = mockAudit();
  } else {
    let brief;
    if (positional[0]) brief = loadBrief(positional[0]);
    else brief = briefFromFlags(flags);

    if (!brief.name && !brief.placeId) {
      console.error(
        "\n  Falta el negocio. Pasa --name \"Nombre\" (y opcional --city), un brief .json, o usa --demo.\n"
      );
      process.exit(1);
    }
    if (!HAS_API_KEY) {
      console.error(
        "\n  No hay GOOGLE_MAPS_API_KEY en .env.\n" +
          "  - Para ver el formato ya mismo:  npm run demo\n" +
          "  - Para datos reales: copia .env.example a .env y pon tu clave\n" +
          "    (activa 'Places API (New)' y 'PageSpeed Insights API' en Google Cloud).\n"
      );
      process.exit(1);
    }
    process.stdout.write(`\n  Generando auditoría de "${brief.name}"...\n`);
    audit = await buildAudit(brief);
  }

  // 2) Renderizar.
  const md = renderMarkdown(audit);
  const slug = slugify(audit.business.name);
  const base = `${slug}-${today()}`;
  const outDir = flags.out
    ? isAbsolute(flags.out)
      ? flags.out
      : resolve(process.cwd(), flags.out)
    : resolve(ROOT, "audits");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const mdPath = resolve(outDir, `${base}.md`);
  writeFileSync(mdPath, md, "utf8");
  const written = [mdPath];

  if (!flags["no-html"]) {
    const htmlPath = resolve(outDir, `${base}.html`);
    writeFileSync(htmlPath, renderHtml(audit), "utf8");
    written.push(htmlPath);
  }
  if (flags.json) {
    const jsonPath = resolve(outDir, `${base}.json`);
    const { business, ...rest } = audit;
    const clean = { business: { ...business, detail: undefined }, ...rest };
    writeFileSync(jsonPath, JSON.stringify(clean, null, 2), "utf8");
    written.push(jsonPath);
  }

  // 3) Resumen en consola.
  consoleSummary(audit);
  process.stdout.write("  Guardado:\n");
  for (const f of written) process.stdout.write(`   - ${f}\n`);
  process.stdout.write("\n");
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}\n`);
  process.exit(1);
});
