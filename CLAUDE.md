# CLAUDE.md — Servicio SEO Local / Google Business / Reseñas

> Este archivo es el contexto maestro del proyecto. Claude Code lo lee automáticamente.

## Quiénes somos
- Jordi (ADE, UNAV) y Jorge (Arquitectura, UNAV), cofundadores de MTRYX.
- Estudiantes, **sin empresa constituida aún** (sociedad irregular). Operación lean: 2 personas + IA.
- Stack que dominamos: **Next.js, Vercel, Supabase**, integraciones API, automatizaciones y **SEO** (Search Console, keyword tools). Ya hicimos la web de un estudio de pilates (**Auraa**) y trabajo SEO/GEO para MTRYX.
- **Restricción clave:** ambos nos vamos de internship fuera este verano (Ljubljana / Ho Chi Minh). Todo lo que montemos debe poder operarse en **remoto y async**. **Producto cerrado, no a medida.**

## Qué estamos montando
Un servicio **productizado de SEO local** para negocios de cita previa (pilates, fisio, estética, dental) en Pamplona/Navarra, vendible también en remoto.
Modelo = **setup (pago único) + mensualidad de gestión**. Detalle en `01-oferta-y-precios.md`.

## El producto en una frase
Hacemos que un negocio local salga en el **Map Pack** de Google (los 3 resultados con mapa) y convierta más clientes, optimizando su **ficha de Google Business**, sus **reseñas** y el **SEO local de su web**. Entramos con un **audit gratis** hecho solo con datos públicos.

## Qué queremos construir CONTIGO (Claude Code) — por prioridad
1. **Generador de auditorías** — script/app que, dado un negocio + 2-3 competidores, recopile datos públicos (ficha, reseñas, posición, web) y genere el audit de 1 página (ver `02-plantilla-auditoria.md`). Objetivo: pasar de ~30 min manuales a ~2 min.
   - ⚠️ Usar la **Google Places API oficial** donde se pueda. **No scrapear los SERPs de Google a saco** (va contra sus ToS y bloquean). Ver `05-marrones-y-politicas.md`.
2. **Landing del servicio** — página simple para parecer serios, alojar la oferta y captar leads. (Next.js/Vercel.)
3. **Sistema de reseñas** — generar link directo + QR de reseña de Google y flujo de petición por WhatsApp/email a **todos** los clientes (sin gating, sin incentivos — ver marrones).
4. **Dashboard de reporte para cliente** — panel que muestre su progreso mensual. Esto **justifica la cuota** y es nuestra ventaja: transparencia vs cajas negras.
5. **Lista de objetivos** — recopilar clínicas/pilates/fisio de Pamplona con los huecos de su ficha marcados, para priorizar el outreach. (Vía Places API.)

## Reglas de trabajo
- **Nada de claims falsos** ni "#1 garantizado": prometemos mejoras concretas en plazos honestos.
- Cumplir **políticas de Google** (reseñas) y **RGPD**. Ver `05`.
- Secretos / API keys en `.env`, **nunca** en el repo. Repo privado.
- **Precio fijo, alcance fijo.** No consultoría a medida.
- Vertical inicial: **bienestar/clínicas en Pamplona**. Caso de referencia: **Auraa**.

## Archivos del proyecto
- `01-oferta-y-precios.md` — la oferta y los precios
- `02-plantilla-auditoria.md` — plantilla del audit gratis de 1 página
- `03-playbook-entrega.md` — cómo entregamos (palancas de SEO local / GBP / reseñas)
- `04-captacion-outreach.md` — gancho + scripts de DM/email + target
- `05-marrones-y-politicas.md` — políticas de Google, RGPD, ToS, riesgos
- `targets/lista-objetivos.md` — seguimiento de objetivos y estado
