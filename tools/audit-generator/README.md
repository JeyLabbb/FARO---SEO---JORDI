# Generador de auditorías (Prioridad 1)

Dado un negocio + búsquedas objetivo, recopila **datos públicos** (Google Places
API oficial + PageSpeed Insights + su propia web) y genera el **audit de 1 página**
de `02-plantilla-auditoria.md` en Markdown y HTML imprimible.

Objetivo: pasar de ~30 min manuales a ~2 min. **Cero dependencias** (solo Node ≥ 20).

## Probarlo ya (sin API key)

```powershell
cd tools\audit-generator
npm run demo
```

Genera `audits/auraa-estudio-pilates-AAAA-MM-DD.md` y `.html` con datos de ejemplo.
Abre el `.html` en el navegador para ver cómo queda para enviar al cliente.

## Datos reales

1. Copia `.env.example` a `.env` y pon tu `GOOGLE_MAPS_API_KEY`.
2. En Google Cloud activa **Places API (New)** y **PageSpeed Insights API**.
3. Lanza una auditoría:

```powershell
# Desde un brief JSON (recomendado, reproducible):
npm run audit -- examples\auraa.json

# O con flags sueltos:
npm run audit -- --name "Fisioterapia X" --city Pamplona ^
  --searches "fisio Pamplona,fisioterapia deportiva Pamplona,fisio cerca de mí"
```

Si no pasas competidores, se **auto-detectan** los 3 primeros de tu primera
búsqueda. Si no pasas web, se coge la de la ficha de Google.

## El brief (JSON)

```json
{
  "name": "Nombre exacto de la ficha",
  "city": "Pamplona",
  "website": null,
  "searches": ["búsqueda 1", "búsqueda 2", "búsqueda 3"],
  "competitors": []
}
```

Campos opcionales: `placeId` (salta la búsqueda por nombre), `lat`/`lng`/`radius`
(para sesgar a una zona que no esté en la lista de ciudades de `src/config.mjs`).

## Flags

| Flag | Qué hace |
|---|---|
| `--demo` | Datos de ejemplo, sin llamar a ninguna API |
| `--name` | Nombre del negocio |
| `--city` | Ciudad/zona (def. Pamplona) |
| `--searches "a,b,c"` | 1-3 búsquedas objetivo |
| `--competitors "x,y"` | Competidores explícitos (si no, se auto-detectan) |
| `--website <url>` | Web del cliente (si no, la de su ficha) |
| `--place-id <id>` | Place id de Google |
| `--out <dir>` | Carpeta de salida (def. `audits/`) |
| `--no-html` | No generar HTML |
| `--json` | Volcar también el JSON crudo |

## Qué da la API y qué no (honestidad — ver `05-marrones-y-politicas.md`)

- ✅ **Sí** (vía API oficial): categoría, nota, nº reseñas, recencia, horario,
  muestra de fotos, web, teléfono, y posición **aproximada** (orden de Places).
- ✋ **Revisar a mano** (la API no lo expone): posts de los últimos 30 días,
  Q&A respondidas, y si responden a las reseñas. El informe lo marca con enlace
  directo a la ficha para verlo en segundos.
- 🚫 **Nunca** scrapeamos los SERPs de Google. La posición se etiqueta como
  aproximada, no como el ranking exacto del Map Pack.

## Estructura

```
src/
  index.mjs        CLI
  config.mjs       carga .env + ciudades/constantes
  mock.mjs         datos del modo demo
  lib/
    places.mjs     Google Places API (New)
    pagespeed.mjs  PageSpeed Insights
    website.mjs    análisis de la web propia del cliente
    audit.mjs      orquestación + lógica de quick wins
    render.mjs     Markdown + HTML
```

La lógica de `lib/` está separada del CLI a propósito: cuando montemos la
**landing (P2)** o el **dashboard (P4)** en Next.js, estas funciones se reutilizan
desde un endpoint sin tocar nada.
