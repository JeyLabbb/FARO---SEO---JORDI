# Credenciales y etapas — máquina de outreach

> Qué necesito para tener TODO funcionando a escala. 🔒 Las claves van al `.env`
> de `tools/audit-generator/` o se sacan de Supabase con la anon key del Brain
> (la tiene Jorge) — **nunca en el chat / WhatsApp**.

## Estado por credencial

| # | Credencial | Estado | De dónde sale | Para qué |
|---|---|---|---|---|
| 1 | **Google Maps/Places key** | ✅ ya en `.env` | proyecto Google Cloud MTRYX | Audits (ficha, posición aprox, PageSpeed) |
| 2 | **DataForSEO** LOGIN + PASSWORD | ❌ falta | **Jorge** (env vars torre, virtualenv `seo-toolkit`) | **Map Pack REAL** + listados con **teléfono/web** a escala |
| 3 | **Brevo** API key (+ SMTP) | ❌ falta | Supabase `agent_config` → `integration_credentials_brevo` | **Enviar emails** (≤50/día sin warm-up) |
| 4 | **Apify** token | ❌ falta | `agent_config` → `integration_credentials_apify` | Scrapear **emails** donde Google no los da |
| 5 | **Supabase** (URL + anon/service key) | ❌ falta | Jorge | CRM real: tabla `outreach_campaigns` |
| 6 | **Vercel** token | ❌ falta | `agent_config` → `integration_credentials_vercel` | Desplegar el cron del pipeline (sin depender de la torre) |
| 7 | **Smartlead** + 2-3 dominios burner | 💳 comprar (~100$) | nuevo | **Escalar email a 500-1000/día** con warm-up |

## Lo que necesito de ti / Jorge, por prioridad
1. **DataForSEO LOGIN + PASSWORD** (Jorge) → al `.env`. *Es lo que más sube la calidad: posición real + teléfonos de todos.*
2. **Brevo API key** (`integration_credentials_brevo`) → al `.env`. *Enciende el email automático.*
3. **Apify token** (`integration_credentials_apify`) → al `.env`. *Más emails.*
4. **Decisión de compra:** ¿compro Smartlead (39$/mes) + 2 dominios (~60$/año) hoy? *Arranca el warm-up de 2-4 semanas, que es el único reloj que el dinero no acorta después.*
5. (Cuando despleguemos) **Vercel + Supabase** para dejarlo corriendo solo.

Para sacar las de Supabase: `select value from agent_config where key = 'integration_credentials_brevo'` (etc.) con la anon key del Brain → me pasas el valor por un canal seguro, lo meto en `.env`.

## Etapas

- **Etapa 0 — HOY (✅ ya listo):** audits + PDFs + WhatsApp manual (valor primero). No espera nada. → empieza a enviar.
- **Etapa 1 — Validar (esta semana):** + DataForSEO (rankings reales + teléfonos) + Brevo (email ≤50/día) + Apify (emails). → audits perfectos, email automático bajo volumen, **medir % de respuesta en 3-4 días**.
- **Etapa 2 — Escalar (~2-3 semanas):** comprar dominios burner + Smartlead + warm-up → 500-1000 emails/día. + Vercel cron + Supabase tracking → **todo automático y desplegado** (no depende de tu portátil ni de la torre).
- **Etapa 3 — Entrega automatizada:** agentes para posts/reseñas/reporte mensual, para que cerrar muchos no os ahogue.
