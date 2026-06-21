# Para cuando vuelvas — estado y próximos pasos

Sesión autónoma del 4-jun. Te resumo qué he montado, qué hacer, y qué he visto interesante.

## 👀 Empieza aquí
Abre **`dashboard.html`** (doble clic, raíz del repo) — lo ve TODO de un vistazo: KPIs, estado del sistema (qué está hecho / qué falta), cómo funciona el flujo, el roadmap y el pipeline de los 24 negocios. Refresca con `npm run dashboard`.

## ✅ Hecho esta sesión
- **Leído el inventario completo del BRAIN** (el PDF) → todo mapeado en `CREDENCIALES.md`.
- **Arreglado el bug de fichas** (resolución por mejor coincidencia de nombre) → **Nieves ya sale bien** (32 reseñas, antes 0). *(Nota: "Punto Pilates" es "Mª Jesús Carretero Center" en Google — misma ficha, su nombre real.)*
- **Mensajes reescritos a "valor primero"** (no "¿os interesa?") y **quitada la mentira de Auraa** (está en Venezuela, no aquí).
- **PDFs reales** de cada audit (con Chrome) — listos para enviar.
- **Pipeline TODO-EN-UNO** (`npm run run`): resuelve → audita → PDF → busca email → WhatsApp + email → tracker CSV. Probado, **9/9 + 15 más**.
- **Email-finder** propio (saca emails de la web del negocio, sin Apify).
- **Módulos listos para enchufar** (en cuanto haya creds): `dataforseo.mjs` (Map Pack real + teléfonos), `brevo.mjs` (envío de email).
- Docs: `CREDENCIALES.md`, `SISTEMA.md`, `.env.example`.

## 📁 Dónde está todo (en `tools/audit-generator/audits/`)
- `*.pdf` — los audits para enviar.
- `_whatsapp-shortlist-pamplona-FECHA.md` y `_whatsapp-objetivos-pamplona-2-FECHA.md` — links de WhatsApp + mensajes.
- `_emails-*-FECHA.md` — emails listos.
- `outreach-tracker-*-FECHA.csv` — el CRM (negocio, tel, email, estado…).

## ▶️ Qué hacer al volver (orden)
1. **Abre `audits/OUTREACH-QUEUE-FECHA.md`** — es **tu lista única**: 24 negocios ordenados por prioridad, con link de WhatsApp + email + PDF de cada uno. Ve de arriba a abajo: clic en WhatsApp → envía el mensaje → adjunta el PDF. 👉 Empieza por los de arriba (sin web), puede caer el primer "sí" hoy. (Verifica la ficha antes de enviar.)
2. **Pásame las 3 credenciales** (de Jorge / Supabase) → `CREDENCIALES.md`: **DataForSEO**, **Brevo**, **Apify**. Con eso enciendo posición real + email automático.
3. **Decisión de compra:** ¿Smartlead (39$/mes) + 2 dominios (~60$/año)? Arranca el warm-up (2-4 sem) = el único reloj que el dinero no acorta.

## 💡 Oportunidades que he visto (tú decides)
- **El pozo de farmacias del BRAIN:** 22.820 en España + 265 en Pamplona ya enriquecidas. Es una lista de leads ENORME y ya hecha. Si quieres volumen rápido, **farmacias** puede ser más rápido que bienestar (leads listos + el BRAIN ya investiga farmacias). Combinable con esto.
- **Desplegar el pipeline en Vercel (cron) + Supabase:** lo dejamos corriendo solo, sin depender de tu portátil ni de la torre de Jorge. Automatización de verdad.
- **Sistema de reseñas por WhatsApp (P3):** la WhatsApp Cloud API del BRAIN está lista para pedir reseñas a clientes post-venta (con plantilla aprobada). En cuanto cierres el 1º, lo montamos.
- **Imágenes con IA** (gpt-image-2 / Gemini que ya tenéis) para los posts de las fichas → entrega automatizada.

## ⚠️ Honesto (para no llevarnos sustos)
- **Verifica el negocio antes de enviar** (que la ficha y el email son los suyos): el email-finder acierta ~⅓ y a veces pilla un email despistado.
- **Email a escala tiene física:** ≤50/día desde mtryx.com hasta calentar dominios. Por eso urge la decisión de Smartlead.
- **Los 10k de junio** dependen de cuántos CIERRES y ENTREGUES, no de cuántos audits (de esos ya hay 24+). Validamos % de respuesta esta semana y escalamos lo que funcione.
