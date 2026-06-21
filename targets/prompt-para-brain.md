# MEGA-PROMPT para el MTRYX BRAIN

> Pégaselo tal cual. Objetivo: inventario técnico exacto para montar una máquina
> de auditorías + outreach a escala (WhatsApp manual rápido + email automático).

---

Necesito un INVENTARIO TÉCNICO EXACTO para montar una máquina de auditorías de SEO local + outreach a escala. Responde separando SIEMPRE lo que está **✅ montado y funcionando HOY** de lo **🔧 hay que montar** y lo **❌ no tenemos**. **NO pegues claves/API keys en texto plano** — dime SÓLO dónde viven (tabla de Supabase, fichero, variable) y yo las saco de forma segura. Sé concreto: nombres de herramientas, planes, límites, endpoints.

**1) DataForSEO**
- ¿Acceso activo? ¿Dónde están las credenciales?
- ¿Qué APIs/planes están contratados: SERP, Google Maps / Local Finder, Business Data / Business Listings, Labs, Reviews?
- ¿Saldo/límite mensual y coste aproximado por llamada?
- ¿Puedo obtener con ello (a) el ranking REAL del Map Pack para "keyword + ubicación (lat/lng)", y (b) listados de negocios por categoría+zona CON contacto (email, teléfono, web, redes)?

**2) Otras fuentes de datos / leads**
- ¿Buscador de emails (Hunter, Snov, Apollo, Clearbit) o base de leads? ¿Scraping propio?
- ¿Otras herramientas de pago activas además de Ahrefs y DataForSEO?

**3) ENVÍO DE EMAIL (lo más importante para escalar)**
- ¿Qué dominios tenemos (además de mtryx.com)? ¿Hay dominios secundarios para outreach en frío?
- ¿Plataforma de cold email (Instantly, Smartlead, Lemlist, Mailreach…) o solo Gmail API (jeylabbb / mtryx.web)?
- ¿Buzones CALENTADOS para frío? ¿Capacidad de envío diaria segura actual?
- ¿SPF/DKIM/DMARC configurados? ¿en qué dominios?
- ¿Existe ya un motor de secuencias (pasos, follow-ups, detección de respuesta, baja/unsubscribe)?

**4) WhatsApp**
- WhatsApp Cloud API: ¿en qué número?, ¿puede enviar mensajes/plantillas?, ¿restricciones? (lo usaríamos para el flujo de reseñas de clientes, no para frío).

**5) Pipeline / CRM / hosting**
- ¿Dónde registramos leads/envíos/respuestas? ¿Hay tabla en Supabase? Dame el esquema si existe.
- ¿Puedo desplegar un servicio pequeño (función en Vercel o cron en la torre de Jorge) que ejecute el pipeline de outreach?
- ¿Un agente puede enviar emails programados vía Gmail API con throttling, o mejor una plataforma?

**6) PDF / assets**
- ¿Forma de generar PDF desde HTML (servicio con API, o podemos instalar Puppeteer/Chromium en la torre)?

**7) Lo que se te ocurra**
- ¿Qué tenemos YA montado (que no haya preguntado) que sirva para: audit → enviar a escala → cerrar → entregar (posts/reseñas/reporte) de forma automática?

Devuélvelo como lista con ✅ / 🔧 / ❌ y la ubicación de cada credencial.
