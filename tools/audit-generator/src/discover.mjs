#!/usr/bin/env node
// discover.mjs — Buscador de objetivos (Prioridad 5).
//
// Dada una lista de categorías + ciudad, usa la Places API oficial para listar
// negocios y marcar los "huecos" de su ficha (sin web, pocas reseñas, nota
// baja). Ordena por OPORTUNIDAD: ficha más floja = mejor objetivo para entrar
// con un audit (hay más que arreglar y es más fácil destacar).
//
// Uso:
//   npm run discover -- --categories "pilates,fisioterapia,clínica dental,centro estética" --city Pamplona
//   (si no pasas categorías, usa las verticales del proyecto)

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { REPO_ROOT, HAS_API_KEY, resolveLocationBias } from "./config.mjs";
import { textSearch } from "./lib/places.mjs";
import { today, slugify } from "./lib/slug.mjs";

// Verticales por defecto (de CLAUDE.md / 04-captacion-outreach.md).
const DEFAULT_CATEGORIES = [
  "pilates",
  "fisioterapia",
  "clínica dental",
  "centro de estética",
  "peluquería",
];

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else (flags[key] = next), i++;
  }
  return flags;
}

/** Puntúa cuánto "hueco" tiene una ficha. Más alto = mejor objetivo. */
function opportunity(p) {
  let score = 0;
  const reasons = [];
  if (!p.websiteUri) {
    score += 3;
    reasons.push("sin web");
  }
  const reviews = p.userRatingCount ?? 0;
  if (reviews < 15) {
    score += 3;
    reasons.push(`solo ${reviews} reseñas`);
  } else if (reviews < 40) {
    score += 2;
    reasons.push(`${reviews} reseñas`);
  } else if (reviews < 80) {
    score += 1;
  }
  if (p.rating != null && p.rating < 4.3) {
    score += 1;
    reasons.push(`nota ${p.rating.toFixed(1)}`);
  }
  if (p.rating == null) {
    score += 1;
    reasons.push("sin nota");
  }
  return { score, reasons };
}

function level(score) {
  if (score >= 5) return "🔥 alta";
  if (score >= 3) return "media";
  return "baja";
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (!HAS_API_KEY) {
    console.error(
      "\n  No hay GOOGLE_MAPS_API_KEY en .env. Pon tu clave primero " +
        "(ver .env.example) y vuelve a lanzar.\n"
    );
    process.exit(1);
  }
  const city = flags.city || "Pamplona";
  const categories =
    typeof flags.categories === "string"
      ? flags.categories.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_CATEGORIES;
  const perCategory = Number(flags.per || 12);
  const bias = resolveLocationBias({ city, lat: flags.lat, lng: flags.lng });

  process.stdout.write(
    `\n  Buscando objetivos en ${city}: ${categories.join(", ")}...\n`
  );

  const rows = [];
  const seen = new Set();
  for (const cat of categories) {
    let results = [];
    try {
      results = await textSearch(`${cat} ${city}`, bias, 20);
    } catch (err) {
      console.error(`  ! "${cat}" falló: ${err.message}`);
      continue;
    }
    for (const p of results.slice(0, perCategory)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const { score, reasons } = opportunity(p);
      rows.push({
        name: p.displayName?.text || "(sin nombre)",
        category: p.primaryTypeDisplayName?.text || cat,
        searchedAs: cat,
        reviews: p.userRatingCount ?? 0,
        rating: p.rating ?? null,
        hasWeb: Boolean(p.websiteUri),
        website: p.websiteUri || "",
        address: p.formattedAddress || "",
        score,
        reasons,
      });
    }
  }

  rows.sort((a, b) => b.score - a.score || a.reviews - b.reviews);

  // Tabla markdown para pegar/seguir en targets/.
  const header =
    "| # | Negocio | Tipo | Reseñas | Nota | Web | Oportunidad | Huecos |\n" +
    "|---|---|---|---|---|---|---|---|";
  const body = rows
    .map((r, i) => {
      const web = r.hasWeb ? "sí" : "**no**";
      const nota = r.rating != null ? r.rating.toFixed(1) + "⭐" : "—";
      return `| ${i + 1} | ${r.name} | ${r.searchedAs} | ${r.reviews} | ${nota} | ${web} | ${level(
        r.score
      )} | ${r.reasons.join(", ") || "ficha decente"} |`;
    })
    .join("\n");

  const md = `# Objetivos auto-detectados — ${city} (${today()})

> Generado con la Places API oficial. Ordenado por **oportunidad**: ficha más
> floja arriba (más fácil entrar con un audit). Revisa que encajen con la
> vertical de bienestar/clínicas antes de contactar.

${header}
${body}

_${rows.length} negocios. Siguiente paso: elige ~10, genera su audit_
_(\`npm run audit -- --name "..." --searches "..."\`) y contacta con la plantilla de \`04-captacion-outreach.md\`._
`;

  const outDir = flags.out
    ? isAbsolute(flags.out)
      ? flags.out
      : resolve(process.cwd(), flags.out)
    : resolve(REPO_ROOT, "targets");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `objetivos-${slugify(city)}-${today()}.md`);
  writeFileSync(outPath, md, "utf8");

  // Resumen en consola: top 10.
  process.stdout.write(`\n  Top objetivos (de ${rows.length}):\n`);
  rows.slice(0, 10).forEach((r, i) => {
    process.stdout.write(
      `   ${String(i + 1).padStart(2)}. ${r.name} — ${r.reviews} reseñas, ${
        r.hasWeb ? "con web" : "SIN WEB"
      } [${level(r.score)}]\n`
    );
  });
  process.stdout.write(`\n  Lista completa: ${outPath}\n\n`);
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}\n`);
  process.exit(1);
});
