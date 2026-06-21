# El sistema de outreach — cómo funciona y cómo se usa

Máquina: **encontrar negocios → auditar → contactar → cerrar → (entregar)**. Todo el código en `tools/audit-generator/`. Cero dependencias salvo Node ≥ 20 (y Chrome/Edge para PDF, ya instalado).

## Un comando lo hace todo
```powershell
cd tools\audit-generator
npm run run -- examples\shortlist-pamplona.json
```
Para cada negocio: resuelve su ficha → genera el **audit** (.md + .html + **.pdf**) → busca su **teléfono** y **email** → escribe el **mensaje de WhatsApp** (con link que abre WhatsApp ya escrito) y el **email** → vuelca un **tracker CSV**.

Salida en `audits/`:
- `<negocio>-FECHA.pdf` — lo que envías al cliente.
- `_whatsapp-envios-FECHA.md` — links de WhatsApp + mensajes (envío manual rápido).
- `_emails-FECHA.md` — emails listos (asunto + cuerpo + a quién).
- `outreach-tracker-FECHA.csv` — CRM (importable a Supabase `outreach_campaigns`).

## Otros comandos
| Comando | Qué hace |
|---|---|
| `npm run discover -- --city Pamplona` | Lista negocios de una ciudad por "oportunidad" (banco de objetivos) |
| `npm run run -- <briefs.json>` | Pipeline completo (audit+PDF+contacto+mensajes+tracker) |
| `npm run audit -- --name "..." --searches "..."` | Un audit suelto |
| `npm run pdf` | Convierte los .html de `audits/` a .pdf |
| `npm run demo` | Audit de ejemplo sin API key |

## Módulos (`src/lib/`)
- `places.mjs` — Google Places (ficha, posición aprox, **resolución por mejor coincidencia de nombre**).
- `dataforseo.mjs` — Map Pack **REAL** + listados con teléfono/web. *Se activa solo si hay creds DataForSEO en `.env`.*
- `pagespeed.mjs` — velocidad móvil. `website.mjs` — analiza su web. `findemail.mjs` — saca emails de su web.
- `audit.mjs` — orquesta + quick wins. `render.mjs` — Markdown + HTML premium. `message.mjs` — WhatsApp/email (valor primero).
- `brevo.mjs` — envío de email (Brevo). *Se activa con `BREVO_API_KEY`.*

## Estado honesto
- ✅ **Funciona HOY:** audits + PDFs + WhatsApp manual + email-finder básico.
- 🔧 **Mejora al meter DataForSEO:** posición = Map Pack **real** (no aproximado) y teléfono de todos sin depender del scrape.
- 🔧 **Email automático:** con `BREVO_API_KEY`, `npm run` + un dispatcher envía (≤50/día hasta calentar dominios; ver `CREDENCIALES.md`).
- ⚠️ **Resolución de fichas:** mejorada (elige por nombre), pero para 100% fiable conviene place_id de DataForSEO. **Revisar el negocio antes de enviar** sigue siendo buena idea.

## Roadmap → ver `CREDENCIALES.md` (etapas 0-3)
Validar (esta semana, ≤50/día) → escalar (Smartlead + dominios burner + warm-up, 500-1000/día) → automatizar entrega (agentes).
