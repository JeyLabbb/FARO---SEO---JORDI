# FARO — VISIÓN COMPLETA Y HOJA DE RUTA DEFINITIVA

*Documento maestro para Jordi y Jorge. Español de España, directo, sin relleno. Marca de cara al cliente: **Faro** (nunca MTRYX). Precio de cierre: **190 €/mes, sin setup, sin permanencia**. "La nube" = automatizaciones que ya usáis (GitHub Actions + Vercel + Supabase).*

> **Regla de oro de todo el documento:** el diferenciador de Faro es la **transparencia**. Técnicamente: *si un dato no existe todavía para un cliente, se muestra un vacío honesto ("aún acumulando tu histórico"), NUNCA un dato heredado del demo (Pagadi) ni una cifra inventada.* Hoy esto se incumple en varios sitios y es el riesgo #1 de marca.
>
> **Segunda regla, la que Jordi teme olvidar:** *nada de lo que prometemos puede depender de que Jordi o Jorge estén delante de un portátil.* Se van de internship. Todo lo recurrente (medir, informar, cobrar, avisar, responder) o corre solo en la nube, o es un ritual async de <30 min que cualquiera de los dos hace desde el móvil. Lo que no cumpla esto, no existe.

---

## 0) LO QUE EL BORRADOR NO CUBRÍA BIEN (puntos ciegos que Jordi teme)

Antes de la hoja de ruta, aquí está lo que faltaba o estaba flojo en el borrador. Cada uno se desarrolla en su sección, pero los reúno aquí para que **no se escape ninguno**:

1. **Legal/RGPD de verdad, no como nota al pie.** Falta el **contrato de encargo de tratamiento** Faro↔negocio (firmado, no mencionado), la **base legal** para tratar los datos de los clientes finales de la clienta (sus pacientes/clientas), el **micro-aviso de privacidad** en el punto donde el negocio captura el contacto, y qué pasa con esos datos **cuando el cliente se va**. Sin esto, pedir listas de clientes finales para reseñas es una brecha de RGPD con multa. Sección 7.

2. **Offboarding / churn operativo.** El borrador habla del churn como riesgo *comercial* pero no del churn *operativo*: cuando un cliente se va, ¿qué pasa con los accesos que nos dio a su Google, su web, su Analytics? ¿Y con sus datos en Supabase? ¿Y con el token OAuth? Hoy **no hay proceso de baja** y eso es un agujero de seguridad y de RGPD. Sección 8.

3. **Seguridad de los accesos que nos dan.** Nos convertimos en administradores del Google Business, la web y Analytics de varios negocios. Si nos hackean la cuenta Google de Faro, comprometemos a **todos** los clientes a la vez. Falta: 2FA obligatorio, cuenta Google dedicada (no la personal de nadie), gestor de contraseñas, principio de rol mínimo, y qué hacer ante un incidente. Sección 9.

4. **Facturación recurrente y morosidad.** El borrador cubre el *primer* cobro pero no el **fallo de cobro recurrente** (tarjeta caducada, sin fondos), el flujo de **dunning** (reintentos de Stripe), qué se le corta al cliente moroso y cuándo, ni la **facturación fiscal** (sois sociedad irregular sin empresa constituida: ¿quién emite la factura? ¿IVA? ¿autónomo?). Esto es un marrón fiscal y de tesorería. Sección 10.

5. **Soporte y canal de comunicación.** ¿Por dónde escribe el cliente cuando tiene una duda o una queja? ¿Cuánto tardáis en responder estando en husos horarios de Ljubljana / Ho Chi Minh? Falta un **SLA de soporte honesto** y un canal único (no el WhatsApp personal de Jordi). Sección 11.

6. **Expectativas y plazos honestos por escrito.** Vendéis Map Pack, pero el SEO local tarda **semanas o meses** y depende de la competencia. Falta un **documento de expectativas** que el cliente firme: qué verá el mes 1 (setup, no ranking), cuándo empiezan a moverse las cosas, y que **no garantizáis el #1**. Sin esto, el churn del mes 2-3 por "no veo resultados" está asegurado. Sección 12.

7. **Dependencia de aprobaciones de Google (el reloj que no controláis).** El borrador lo menciona pero no lo trata como **riesgo de calendario crítico**: la GBP API tarda **semanas** en aprobarse y la verificación OAuth otras tantas. Si arrancáis el trámite tarde, el panel con datos reales no llega para el verano. Hay que **arrancar el reloj YA** aunque no haya clientes. Sección 5, P2 #14, y aquí lo elevo a acción inmediata.

8. **Continuidad / bus factor.** Sois 2 y os vais los dos. ¿Qué pasa si uno se desconecta una semana (exámenes, viaje, enfermedad)? ¿El otro sabe operarlo todo solo? Falta un **runbook** mínimo y accesos compartidos (no en la cabeza de uno). Sección 8 y 11.

9. **Qué NO vender / decir que no.** Falta un criterio explícito de **descalificación de leads** (negocios sin ficha verificable, sin web y sin intención de tenerla, en sectores fuera del vertical, o que exijan garantías de #1). Cerrar al cliente equivocado cuesta más que no cerrarlo. Sección 12.

Todo lo anterior está integrado en las secciones que siguen y en la hoja de ruta de la sección 5.

---

## 1) EL VIAJE DEL CLIENTE, DE PUNTA A PUNTA

Cómo debería fluir un negocio desde nombre en una lista hasta que renueva el mes 2. **[HOY]** = ya funciona; **[FALTA]** = no existe aún.

**Paso 0 — Lead frío.** El robot de outreach (en la nube, envía solo cada mañana) manda su audit personalizado con datos reales por email/WhatsApp. **[HOY funciona.]**

**Paso 1 — Responde e interesa.** El lead responde (email, WhatsApp o formulario de la landing). Agujero: el formulario solo manda un aviso por email a una cuenta Gmail; **si Brevo falla, el lead se pierde sin rastro** y no queda guardado. **[FALTA: guardar el lead en Supabase.]**

**Paso 2 — Llamada/cierre + cualificación.** Jordi o Jorge hablan, resuelven dudas y cierran de palabra a 190 €/mes. Aquí se hace también la **cualificación** (¿tiene ficha verificable? ¿web? ¿está en el vertical? ¿acepta plazos honestos?) — descartar al lead equivocado es parte del paso. En el "sí" se piden ya los accesos (sección 2) y se acuerda el pago. **[HOY manual, y así debe seguir: cerrar es humano. FALTA el guion de cualificación/descarte.]**

**Paso 3 — Pago.** Se envía **un** enlace de pago de Stripe con el precio real (190 €/mes) y con los datos del negocio precargados (nombre, ciudad, web, place_id, keywords). Hoy NO cuadra: los links existentes son de 490 setup + 290/mes, no de 190, y no llevan datos del negocio. **[FALTA: crear el precio real de 190 en Stripe y links con metadata.]**

**Paso 4 — Alta automática.** En cuanto Stripe confirma, un webhook en la nube da de alta al cliente **solo**: crea su ficha, crea su usuario (con **invite/magic-link**, no contraseña inventada), manda email de bienvenida con acceso al panel, y lanza su primera medición real. Hoy **nada de esto existe**: alta 100% manual por terminal con contraseña inventada a mano. **[FALTA: el hueco más grande del onboarding.]**

**Paso 5 — Accesos + papeleo legal.** El cliente recibe un mensaje que pide los 4 accesos (ficha de Google, Search Console, web, Analytics) con pasos exactos, **firma el encargo de tratamiento (RGPD)** y **firma/acepta el documento de expectativas y plazos**. Todo por invitación y async. Hoy no existe ni el documento ni el email. **[FALTA.]**

**Paso 6 — Entrega.** Con los accesos: optimizar ficha, montar sistema de reseñas, tocar SEO de la web. Hoy 100% manual (entrando a mano a cada cuenta de Google). **[HOY manual; automatizar lo repetitivo.]**

**Paso 7 — Panel en vivo.** El cliente entra y ve su progreso real. Un robot re-mide cada semana en la nube y actualiza el panel solo. Hoy ese robot **existe pero no está programado en la nube**: solo corre si alguien lo lanza desde su portátil — inviable en internship. **[FALTA: programarlo.]**

**Paso 8 — Informe mensual.** El día 1 de cada mes se genera y envía solo un PDF con la evolución real. Hoy **no existe ni una línea de código**. **[FALTA.]**

**Paso 9 — Facturación recurrente.** Stripe cobra solo cada mes. Si el cobro **falla** (tarjeta caducada), hay dunning automático y un aviso; si no paga, se le suspende el panel con un mensaje honesto. Hoy no hay flujo de morosidad. **[FALTA.]**

**Paso 10 — Renovación o baja.** Sin permanencia, la renovación se gana cada mes con informe + panel vivo. Si se va: **offboarding** (retirar nuestros accesos, exportar/borrar sus datos según RGPD, mensaje de cierre cordial). Hoy no hay proceso de baja. **[FALTA.]**

**Resumen honesto del viaje hoy:** funcionan los pasos 0, 2 y 6. Todo lo del medio (guardar lead → pago con precio bueno → alta automática → accesos+legal → panel vivo → informe → dunning → baja) es una cadena de pasos manuales sueltos enganchados a mano por WhatsApp. Eso **no es operable en remoto/async**, que es justo lo que el proyecto exige.

---

## 2) CHECKLIST DE ACCESOS QUE LE PEDIMOS AL CLIENTE

Dos reglas innegociables: **(1) siempre por invitación con roles, nunca contraseñas compartidas** (más seguro y limpio si se va); **(2) pedir el rol mínimo que permita trabajar.** Todo por email/WhatsApp con pasos + captura, sin llamada.

| # | Acceso | Para qué | Rol que pedimos | Cómo se lo pedimos |
|---|--------|----------|-----------------|--------------------|
| 1 **(crítico)** | **Perfil de Empresa de Google** (GBP) | Palanca #1: editar ficha, fotos, posts, responder reseñas | **Administrador** (NO "Propietario principal") | google.com/business → su ficha → Configuración → "Personas y acceso" → Añadir → email de Faro → rol Administrador. Requisito previo: ficha reclamada y verificada. |
| 2 **(crítico)** | **Google Search Console** | Medir posiciones/impresiones reales de su web | **Completo** | Ajustes → Usuarios y permisos → Añadir. Si no la tiene, se la creamos y verificamos por DNS. |
| 3 **(alto)** | **Web / CMS** | Meta/H1 locales, schema LocalBusiness, NAP en footer | WordPress: **usuario nuevo Administrador** con email de Faro. Wix/Squarespace/Shopify: **colaborador con permisos de edición** | Que cree un usuario, no que comparta su login. Si hay que tocar velocidad/DNS a bajo nivel, subcuenta de hosting/cPanel. |
| 4 **(alto)** | **Google Analytics (GA4)** | Reportar tráfico/conversiones | **Analista** (nunca Administrador) | Admin → Gestión de acceso a la propiedad → "+" → email de Faro. |
| 5 (medio, si aplica) | **Hosting/cPanel** | Solo si el CMS no deja tocar velocidad/DNS/schema | Subcuenta limitada | Solo cuando haga falta. |

**Sin fricción:** lo ideal es **un solo enlace de onboarding** (herramienta tipo Leadsie, o formulario propio en el panel) que pida GBP + Search Console + Analytics + CMS de golpe. El material debe insistir explícitamente: *"invitación, no contraseña"*, porque el cliente por comodidad tenderá a mandarte su clave.

**Casos de bloqueo frecuentes** (estética/fisio pequeños), con guion propio: ficha **no verificada** (hay que reclamarla primero, +días); **sin web** (esa palanca se limita a NAP en directorios); **sin acceso a hosting**.

**Registro de accesos (nuevo):** cada acceso que nos den se anota en una **tabla `client_access` en Supabase** (qué acceso, qué rol, fecha de concesión, estado) para saber async qué tenemos de cada cliente, qué falta para arrancar, y **qué hay que retirar cuando se vaya** (offboarding, sección 8). Sin esto no hay forma de operar la entrega ni la baja sin memoria.

**[Estado hoy: no existe `06-onboarding-accesos.md` ni email de bienvenida que pida accesos. El guion de venta solo pide GBP, le faltan Search Console y Analytics. Es el gap #1 de la entrega.]**

---

## 3) PLAYBOOK DE ENTREGA (qué hacemos y cuándo, con tiempos)

Objetivo operativo: bajar de ~3-4 h/cliente/mes a **~1-1,5 h/cliente/mes** automatizando lo repetitivo, para que **1 persona sostenga 10-12 clientes en <3 h/semana** desde el internship.

### Semana 1 (setup, ~2-3 h el primer cliente):
- Recibir y verificar los 4 accesos; anotarlos en `client_access`.
- **Ficha de Google:** categorías, descripción, horarios (incl. festivos), servicios, atributos, fotos, primeros posts, Q&A.
- **SEO web:** keywords locales en title/H1/meta, schema `LocalBusiness`, mapa embebido, NAP en footer, velocidad móvil básica.
- **Sistema de reseñas:** link directo + QR + cartelito neutro para recepción, y plantilla de petición.
- Primera medición real en el panel (debería dispararse sola con el alta).
- **Enviar el documento de expectativas** (sección 12) para que el cliente sepa que el mes 1 es setup, no ranking.

### Cada semana (~20-30 min/cliente):
- Revisar el panel (auto-medido): **5 min**.
- Responder reseñas nuevas con borrador IA + aprobar: **5-10 min**.
- 1 post en la ficha desde plantilla del vertical: **10 min**.
- Disparar tanda de peticiones de reseña (goteando): **2 min**.
- **A 10 clientes ≈ 4-5 h/semana repartidas entre 2, async.**

### Cada mes (~30-45 min/cliente):
- Revisar posición vs 2-3 competidores (auto del snapshot): **10 min**.
- Auto-generar, revisar y enviar el informe mensual: **15 min**.
- 1 acción SEO del backlog (schema, keyword en title/H1, NAP): **15-20 min**.
- **Cierre de mes ≈ 1 sesión de 4-6 h para los 10 clientes.**

**Qué automatizar sí o sí (por ROI):** (1) medición semanal en la nube; (2) informe mensual auto; (3) petición de reseñas por lote; (4) borrador IA de respuesta a reseñas con aprobación en 1 clic.
**Qué dejar a mano:** edición inicial de ficha, fotos, cierre/onboarding. Con <12 clientes automatizar esto tiene ROI negativo.

**Reseñas — cumplir Google (crítico):** pedir a **todos** (sin gating, sin filtrar por contentos), **sin incentivos**, mensaje **siempre neutro** ("cuéntanos qué tal", nunca "si ha ido bien"), y **responder a todas** en <48 h. Dos riesgos: pedir en masa el mismo día dispara el filtro anti-fake de Google (hay que **gotear**); y por WhatsApp Cloud API una petición de reseña cae en categoría Marketing (post-julio 2025) → **exige opt-in previo** del cliente final o arriesgas el bloqueo del número.

**Tope duro de clientes (decisión, 0 código):** máx **8-10** con los dos en España, **5-6** durante el internship. El outreach genera ~95 leads/día, pero *el cuello es entregar, no generar leads*. Frenar cierres al llegar al tope. **Añadido:** el tope no es solo tiempo total, es **tiempo del que menos disponible esté** — planificad para el peor caso (uno de los dos desaparece una semana por exámenes/viaje), no para la suma de ambos.

---

## 4) CÓMO DEBERÍA VERSE Y FUNCIONAR LA WEB + EL PANEL

### La web (landing, experiencia del lead)
- **Objetivo:** parecer serios, alojar la oferta, captar el lead. Ya cumple.
- **Decisión de negocio consciente y correcta:** el pago **no** es self-serve desde la web ("te pasamos el pago seguro nosotros"). Bien para un servicio que se cierra hablando. El botón de los planes va al formulario, no a Stripe. **Mantenerlo así.**
- **Arreglar:** (a) el formulario debe **guardar el lead en Supabase** además de avisar por Brevo, y **no** decir "ok" si no se guardó nada; (b) alinear el precio mostrado con el de cierre real (o que el discurso no se contradiga con el 490+290).

### El panel de cliente (el diferenciador)
Debería ser: **el cliente entra con su email y ve SOLO datos suyos, todos reales o etiquetados honestamente como "estimado", y jamás una cifra de otro negocio ni una demo.**

**Cómo funciona hoy (y por qué es un problema):** el panel arranca con un objeto de datos **hardcodeado que es en realidad el negocio Pagadi Studio**, lo pinta entero al instante, y solo *después* del login sobreescribe *parte* con lo del cliente real. El resto se queda con datos de Pagadi.

**Bugs de datos falsos que un cliente que paga SÍ vería hoy** (violan la regla de honestidad):
1. Gráfico "Acciones de clientes" y "Crecimiento de reseñas": curvas de 6 meses de Pagadi, nunca se sobreescriben.
2. "Evolución de tu posición" y la columna "Mov.": serie por keyword baked de Pagadi, aunque el histórico real existe en la tabla `rankings`.
3. El chip "+13 este mes": fijo a 13, no se recalcula (aunque el cliente haya bajado).
4. Textos siempre positivos hardcodeados ("Vas por buen camino", "Subiendo en el Map Pack", "creciendo"): mienten si el cliente empeora.
5. Los botones de periodo (7d/30d/90d/6m/1a) muestran todos lo mismo: son cosméticos.
6. Un **cliente recién dado de alta sin keywords o antes de la 1ª medición ve el feed, el plan y los gráficos de Pagadi como si fueran suyos** — solo cambian el nombre y la ciudad. Esto es lo más grave.

**Cómo debería verse:** (a) el dato baked deja de ser Pagadi y pasa a ser **neutro/vacío** (la solución más simple y robusta: si algo se filtra, que no sea un negocio real); (b) todos los gráficos se alimentan de las tablas reales; (c) los textos de tono se calculan del histórico real y pueden ser neutros o a la baja; (d) las 4 KPIs grandes (llamadas/clics/veces-apareces/cómo-llegar) siguen etiquetadas **"est."** — son fórmulas, no datos de Google — y el objetivo a medio plazo es sustituirlas por datos reales cuando el cliente conecte su ficha; (e) la **demo comercial se separa** a una URL aparte (/demo) claramente etiquetada, y el panel de cliente exige login siempre.

*Nota honesta sobre las 4 KPIs grandes:* hoy son **fórmulas estimadas** a partir de reseñas + posición (`est_calls = reviews*1.6 + (12-avgPos)*8`, etc.), **no** datos reales de Google. Están etiquetadas "est." en el footer, lo cual es aceptable, pero si un cliente las compara con su Google Business real y no cuadran, se cae el argumento de transparencia. La solución real es conectar la Google Business Profile Performance API (sección 5).

**Añadido — accesibilidad y confianza del panel:** como es el argumento de venta, el panel debe (i) cargar rápido y en móvil (los dueños de estética/fisio lo mirarán desde el móvil); (ii) tener un **estado vacío honesto y bonito** para cliente nuevo ("Estamos preparando tu ficha, tus primeros datos aparecen en unos días") en vez de un dashboard vacío que parezca roto; (iii) mostrar **la fecha de la última medición** ("actualizado el lunes") para que se note que está vivo.

---

## 5) GAP ANALYSIS + ROADMAP PARA ESTAR 100% CLIENT-READY

Priorizado por importancia. "Esfuerzo" es orientativo.

### 🔴 P0 — Sin esto, un cliente que paga ve datos falsos, el onboarding no funciona en remoto, o hay riesgo legal/seguridad
| # | Qué | Por qué | Esfuerzo |
|---|-----|---------|----------|
| 1 | **Panel: quitar el baked de Pagadi.** Cambiar el objeto por defecto a neutro/vacío; en `loadData` alimentar `revMonthly`, `actSeries` y la serie por keyword (`rankings`) de tablas reales. Estado vacío honesto si no hay datos. | Hoy un cliente real ve curvas y posiciones de otro negocio. Rompe el único diferenciador. | ~1 día |
| 2 | **Panel: textos de tono + delta reales.** Calcular "+N este mes" y "buen camino / estable / a la baja" del histórico real. Quitar literales siempre-positivos. | Mentir "subiendo" cuando baja mata la honestidad. | ~2 h |
| 3 | **Programar el robot de medición semanal en la nube** (`weekly.yml` que corra `panel-snapshot.mjs`; añadir `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` a secrets de GitHub). | Sin esto el panel se congela en el internship; muere el "en vivo". | ~1 h |
| 4 | **Alta automática por webhook de Stripe** (`apps/web/api/stripe-webhook.js`): verifica firma, escucha `checkout.session.completed`, reutiliza `ensureUser/upsertClient/linkUser`, manda bienvenida (invite/magic-link) y lanza la 1ª medición. | Hoy el alta es 100% manual con contraseña inventada. No es async. | ~medio día + config Stripe |
| 5 | **Unificar precio en Stripe a 190 €/mes** y generar links con metadata (negocio, ciudad, web, place_id, keywords). | Los links actuales (490+290) no sirven para cerrar, y sin metadata el webhook no tiene contexto de alta. | ~bajo (config) |
| 6 | **`panel-add-client.mjs`: crear `plan_items` y `activity` por defecto** al alta. | Sin esto, cliente nuevo ve el plan y el feed de Pagadi. | ~30 min |
| 7 | **Persistir el lead del formulario en Supabase** y que `/api/lead` no devuelva "ok" si no guardó. | Hoy si Brevo falla, el lead se pierde sin rastro. | ~bajo |
| 8 | **Legal mínimo para operar: contrato de encargo de tratamiento (RGPD)** + documento de expectativas/plazos, listos para firmar en el onboarding. | Tratar datos de la ficha y de los clientes finales sin encargo firmado es ilegal. Sin expectativas por escrito, churn del mes 2. | ~medio día (adaptar plantilla) |
| 9 | **Seguridad base de la cuenta Google de Faro:** cuenta dedicada (no personal), 2FA obligatorio, gestor de contraseñas compartido. | Somos admin de todos los clientes desde una cuenta; si cae, caen todos. | ~1-2 h |

### 🟠 P1 — Operar en remoto/async, justificar la cuota y cerrar el ciclo de cobro
| # | Qué | Esfuerzo |
|---|-----|----------|
| 10 | **Informe mensual auto** (`monthly-report.mjs` → HTML Faro → PDF con `topdf.mjs`) + `monthly.yml` (cron día 1) que lo envíe por email. | ~1,5-2 días |
| 11 | **Crear `06-onboarding-accesos.md`** (checklist por stack + árboles de decisión "ficha no verificada"/"sin web") y **actualizar el guion de venta** para pedir los 3-4 accesos, no solo GBP, e incluir **cualificación/descarte** del lead. | ~3 h |
| 12 | **Email/WhatsApp de bienvenida post-pago** que enlace al onboarding de accesos + legal, como paso explícito del embudo. | ~45 min |
| 13 | **Sistema de reseñas mínimo:** `reviewLink(placeId)` + generar QR + PDF imprimible + tabla `review_requests` en Supabase. | ~medio día |
| 14 | **Panel: periodos reales** (filtrar snapshots por ventana de fecha en vez de repetir el mismo array). | ~2-3 h |
| 15 | **Vista admin** (en panel-ops): lista clientes/altas/pagos/estado de accesos/estado de cobro, para operar async y cubrir el bus factor. | ~medio día |
| 16 | **Dunning / morosidad:** activar reintentos de Stripe (Smart Retries), email automático de "tu pago falló", y un job que **suspenda el panel** (`clients.active=false`) tras X días de impago con mensaje honesto. | ~medio día + config Stripe |
| 17 | **Canal de soporte único** (no el WhatsApp personal): email `hola@faro...` o número dedicado, con SLA de respuesta honesto (p.ej. "respondemos en 48 h laborables"). | ~1 h (setup) |
| 18 | **Runbook de continuidad** (`RUNBOOK.md`): cómo dar de alta/baja a mano, dónde están los secrets, cómo relanzar los jobs, qué hacer si un job falla — para que **cualquiera de los dos** opere solo. | ~2-3 h |

### 🟡 P2 — Métricas reales y automatización de reseñas (cuando haya 2-5 clientes que lo paguen)
| # | Qué | Esfuerzo |
|---|-----|----------|
| 19 | **Arrancar YA el trámite de Google Business Profile API** (crear/confirmar proyecto GCP, activar APIs, enviar el formulario de acceso con caso de uso concreto). **No bloquea nada pero Google tarda semanas** → arrancar el reloj aunque no haya clientes. Faro/MTRYX ya tiene ficha+web >60 días → cumple requisitos. | ~1-2 h + espera de semanas |
| 20 | **Verificación de la app OAuth de Google** (pantalla de consentimiento, dominio verificado, logo, scopes `business.manage` + `webmasters.readonly` justificados; posible vídeo del flujo). Arrancar en paralelo al #19. | ~medio día + revisión de Google (semanas) |
| 21 | **OAuth "Conectar mi Google" en el panel** + guardar refresh_token **cifrado** por cliente. Job diario que traiga impresiones/llamadas/rutas **reales** y sustituya las 4 KPIs estimadas. Reconexión **self-service** (el cliente re-conecta solo si caduca el token, porque estáis fuera). | ~2-3 días de dev |
| 22 | **WhatsApp Cloud API del BRAIN** cableada para peticiones de reseña (plantilla neutra + flujo de opt-in). Coordinar con Jorge. | ~1-2 días + aprobación Meta |
| 23 | **Search Console API** para el módulo C (keywords/clics/posición reales de la web del cliente en el panel/informe). | ~1 día |

### Riesgos reales a tener presentes
- **Payouts de Stripe:** aunque cobres, el dinero queda retenido hasta completar identidad + IBAN. **Verificar antes de cobrar en serio.**
- **Fiscalidad (sociedad irregular):** sin empresa constituida, ¿quién factura, con qué IVA, a nombre de quién cobra Stripe? Es un marrón que hay que resolver **antes** del primer cobro real (sección 10).
- **Modelo sin permanencia + entrega manual en verano = churn:** el riesgo comercial #1. Considerar permanencia mínima de 3 meses o setup pequeño (150-200 €) que cubra el pico del mes 1 (el setup cuesta 3-4× un mes normal).
- **Verificación de la app OAuth de Google** (scope `business.manage` sobre datos de terceros): puede exigir vídeo del flujo y dominio verificado → semanas extra.
- **Filtro anti-fake de reseñas de Google:** golpear todas el mismo día es contraproducente. Gotear.
- **Bus factor:** sois 2 y os vais. Si uno se desconecta una semana, el otro tiene que poder operarlo todo. De ahí el runbook (#18) y los accesos compartidos.

---

## 6) PLAN CONCRETO PARA MIMOSI

*Mimosi Beauty & Health Concept — estética, Sant Cugat del Vallès. Punto de partida: 27 reseñas / 4.8 vs Sivana 293 / 4.9; web 57/100 en móvil, sin schema local. Estado: por cerrar por WhatsApp.*

Como el webhook de Stripe y el alta automática **aún no existen**, Mimosi se hace con el **flujo manual actual, pero limpio**. Pasos exactos:

**1. Cualificar y cerrar.**
- Confirmar que **cumple**: ficha reclamada/verificable, tiene web (aunque floja: 57/100), está en el vertical (estética). ✅ Cumple.
- Fijar expectativas HONESTAS en el cierre: el mes 1 es **setup** (ficha, schema, sistema de reseñas), los movimientos en Map Pack tardan **semanas**, y **no se garantiza el #1** (Sivana tiene 293 reseñas; el objetivo es cerrar distancia, no adelantarla en un mes).
- Confirmar el "sí" a 190 €/mes por WhatsApp.

**2. Cobrar.**
- Para el primer cliente vale **Bizum/transferencia** o un link de Stripe. ⚠️ Si usas Stripe, **crea antes el price real de 190 €/mes** (los links viejos son 490+290 y no cuadran con lo prometido). Verifica que Stripe tiene payouts activos (identidad + IBAN) o el dinero se queda retenido. ⚠️ **Aclara la factura:** decide ya a nombre de quién se emite y con qué IVA (sección 10) — Mimosi pedirá factura.

**3. Pedir los accesos en el mismo mensaje del cierre** (por invitación, no contraseñas):
- **Perfil de Empresa de Google** → Administrador (imprescindible; sin esto no hay entrega). Comprobar ficha verificada.
- **Search Console** → Completo (si no la tiene, se la creas por DNS).
- **Su web/CMS** → usuario nuevo Administrador (para schema LocalBusiness y arreglar el 57/100 móvil).
- **GA4** → Analista.
- Anota qué te da y qué falta (aunque sea en una nota; el destino es `client_access`).

**4. Papeleo legal antes de tocar sus datos.**
- Firma el **encargo de tratamiento (RGPD)** con Mimosi **antes** de gestionar reseñas de sus clientes finales o pedirle su lista de contactos.
- Envía el **documento de expectativas/plazos** para que quede por escrito qué verá el mes 1.

**5. Alta en el panel (hoy, a mano; que sea limpia):**
- `node src/panel-add-client.mjs --name "Mimosi Beauty & Health Concept" --email <email> --password <aleatoria> --website <web> --keywords "estética sant cugat; depilación láser sant cugat; tratamientos faciales sant cugat"` (ajustad las keywords reales que quiera posicionar).
- ⚠️ **Pasa siempre `--keywords`**, o su panel se queda mostrando datos de Pagadi.
- ⚠️ Tras el alta, **crea a mano al menos una fila de `plan_items` y una de `activity`** (con `panel-log-activity.mjs`), porque `panel-add-client.mjs` no las crea y si no verá el plan y el feed de Pagadi.
- Genera la contraseña **aleatoria** (no una que reutilices) y mándasela por un canal seguro. *(Nota: esto es frágil; cuando exista el invite de Supabase, se sustituye por magic-link.)*

**6. Verificar el panel ANTES de dárselo.** Entra tú con su login y comprueba que **no aparece ni una sola cifra de Pagadi**: gráficos "Acciones de clientes" y "Crecimiento de reseñas", la serie de posición por keyword y el chip "+N este mes". **Hoy varios de esos SÍ mostrarán datos de Pagadi** (bugs P0 #1 y #2). Hasta que se arreglen: o los corriges, o le avisas de que esos módulos aún están en preparación. **No le des el panel si muestra datos de otro negocio** — es literalmente lo contrario del argumento de venta.

**7. Setup de entrega (semana 1):**
- Ficha: categorías/servicios/atributos, horarios, fotos, primeros posts, Q&A.
- Web: schema `LocalBusiness`, NAP en footer, keywords locales en title/H1, atacar el 57/100 móvil (imágenes, velocidad básica).
- Reseñas: generar su link `writereview` (a partir de su place_id, que ya se captura) + QR + cartelito para recepción. Objetivo realista: acercar sus 27 reseñas hacia el peso de la competencia **goteando** peticiones a todos sus clientes, sin incentivos, mensaje neutro, **con opt-in** si es por WhatsApp.

**8. Ritmo mensual:** post semanal en la ficha, responder todas las reseñas en <48 h con borrador IA, tanda de peticiones de reseña, y a fin de mes el informe. Como el informe auto **aún no existe**, el primer mes se lo montas a mano desde lo que muestra el panel (esto justifica priorizar el P1 #10).

**9. Si Mimosi se va (offboarding):** retira los accesos que te dio (o pídele que los revoque), decide qué haces con sus datos en Supabase (sección 8), y despídete cordialmente dejando la puerta abierta. Que la baja sea tan limpia como el alta.

**Cuello de botella honesto con Mimosi:** todo el trabajo de ficha, reseñas y web es **manual** hoy, y el panel tiene bugs que le enseñarían datos de Pagadi. El primer cliente es la **prueba de fuego** para decidir qué automatizar primero (webhook de Stripe, robot semanal, informe mensual). Cierra Mimosi, entrégala a mano, y usa lo que más duela para priorizar el roadmap de la sección 5.

---

## 7) LEGAL Y RGPD (el marrón que no se puede saltar)

Al gestionar la ficha de Google del cliente, su web, su Analytics y —sobre todo— **los datos de contacto de sus clientes finales** (para pedir reseñas), Faro se convierte en **encargado del tratamiento**. Esto obliga a:

1. **Contrato de encargo de tratamiento (art. 28 RGPD) Faro↔negocio.** Documento firmado que diga qué datos tratamos, para qué, durante cuánto, con qué medidas de seguridad y qué pasa al terminar. **Sin esto firmado no se toca ni un dato de clientes finales.** Es P0 #8. Basta adaptar una plantilla estándar; no necesitáis abogado para arrancar, pero sí para revisarla antes de escalar.

2. **Base legal para contactar a los clientes finales del negocio.** El negocio (responsable) necesita **consentimiento o interés legítimo** para cederos esos contactos, y vosotros solo podéis usarlos para lo pactado (pedir reseña, una vez). En el punto de captura (recepción, ticket) debe haber un **micro-aviso de privacidad**: "tus datos podrán usarse para pedirte una opinión". Sin base legal, la campaña de reseñas es sancionable.

3. **Minimización.** Pedid solo lo necesario (para reseñas: nombre + un canal). No acumuléis listas que no vais a usar. Guardad el contacto **hasheado** donde se pueda (ya previsto `destinatario_hash` en la tabla `review_requests`).

4. **Token OAuth = dato personal + credencial sensible.** Cuando llegue el "Conectar mi Google", el refresh_token va **cifrado** en reposo, con acceso mínimo, y se **borra al dar de baja**.

5. **Derechos y borrado.** Si el negocio o un cliente final ejerce sus derechos (acceso, borrado), tenéis que poder responder. De ahí que el offboarding (sección 8) incluya export/borrado.

6. **Vuestra propia situación (sociedad irregular).** Sin empresa constituida, el contrato lo firmáis como personas físicas / sociedad civil. Aclarad **quién es el responsable** ante el cliente y ante la AEPD. Esto empuja hacia constituir algo formal en cuanto haya 2-3 clientes de pago.

**Acción:** redactar/adaptar (a) encargo de tratamiento, (b) micro-aviso de privacidad para el punto de captura, (c) cláusula de tratamiento de datos en el propio contrato de servicio con el cliente. Meterlos en el pack de onboarding (P0 #8).

---

## 8) OFFBOARDING Y CONTINUIDAD (cuando un cliente se va, o cuando uno de vosotros desaparece una semana)

### Offboarding de cliente (hoy no existe, es un agujero de seguridad y RGPD)
Cuando un cliente cursa baja (o deja de pagar tras el dunning), un **proceso reproducible**:
1. **Suspender el panel:** `clients.active=false` → el robot deja de medirle y no ve datos nuevos.
2. **Retirar nuestros accesos:** salir como Administrador de su GBP, Search Console, GA4 y CMS (o pedirle que nos revoque). **Esto es crítico de seguridad:** un ex-cliente al que sigues teniendo acceso es un problema legal y reputacional.
3. **Revocar/borrar el token OAuth** si lo conectó.
4. **Datos en Supabase:** decidir política — export a PDF/CSV para él si lo pide, y **borrado o anonimización** de los datos de sus clientes finales según el encargo de tratamiento (plazo pactado). No dejar listas de contactos de terceros indefinidamente.
5. **Mensaje de cierre cordial** dejando la puerta abierta (el churn de verano puede volver en otoño).

**Acción:** un mini-checklist de offboarding en el `RUNBOOK.md` + un script/comando que ponga `active=false` y marque en `client_access` qué accesos hay que retirar.

### Continuidad / bus factor (sois 2 y os vais los dos)
- **Runbook (`RUNBOOK.md`, P1 #18):** cómo se opera todo a mano si la automatización falla: alta, baja, relanzar el snapshot, regenerar un informe, dónde están los secrets, a quién llamar en Stripe/Supabase/Google.
- **Accesos compartidos, no en una cabeza:** gestor de contraseñas compartido entre Jordi y Jorge con la cuenta Google de Faro, Stripe, Supabase, GitHub, dominios. Si uno pierde el móvil o desaparece una semana, el otro entra.
- **Regla operativa:** ninguna tarea recurrente debe requerir a **una persona concreta**. Todo lo que sea "esto solo lo sé hacer yo" es deuda que hay que documentar antes del verano.

---

## 9) SEGURIDAD DE LOS ACCESOS

Nos dan las llaves del negocio digital de varios clientes desde **una** cuenta Google de Faro. Si esa cuenta cae, caen todos a la vez. Mínimos:

1. **Cuenta Google dedicada de Faro** (no la personal de Jordi ni de Jorge) que reciba todas las invitaciones de GBP/Search Console/GA4. Si un día uno deja el proyecto, no se lleva los accesos.
2. **2FA obligatorio** en esa cuenta Google, en Stripe, en Supabase, en GitHub y en el registrador de dominios. Preferible 2FA por app (no SMS).
3. **Gestor de contraseñas compartido** (Bitwarden/1Password) para todo el equipo; contraseñas únicas y largas; nada de reutilizar.
4. **Rol mínimo siempre** (ya en la sección 2): Administrador en GBP pero no Propietario; Analista en GA4; etc. Cuanto menos poder tengamos, menos daño si nos comprometen.
5. **Secrets fuera del repo** (ya se cumple: `.env`, secrets de GitHub Actions). El refresh_token OAuth cifrado (sección 7).
6. **Plan de incidente mínimo:** si se compromete la cuenta Faro, cambiar contraseña + revocar sesiones + avisar a los clientes afectados (obligación RGPD de notificar brechas en 72 h). Escribirlo en el runbook.

---

## 10) FACTURACIÓN RECURRENTE, MOROSIDAD Y FISCALIDAD

El borrador cubría el primer cobro pero no el ciclo completo.

1. **Fiscalidad primero (bloqueante, sois sociedad irregular sin empresa).** Antes del primer cobro *en serio*: decidir **quién factura** (uno de vosotros como autónomo, una sociedad civil, o constituir SL), **con qué IVA** (servicios de marketing → 21% general), y **a nombre de quién cobra Stripe** (la cuenta debe coincidir con quien declara). Mimosi os pedirá factura. Esto no es opcional: cobrar sin factura correcta es un problema con Hacienda. **Acción de Jordi/Jorge, no de código, pero antes de cobrar.**

2. **Suscripción real en Stripe.** Crear el **precio recurrente de 190 €/mes** (no un pago único repetido a mano) para que Stripe cobre solo cada mes. Con metadata del negocio (para el webhook).

3. **Dunning / fallo de cobro (P1 #16).** Configurar en Stripe **Smart Retries** (reintentos automáticos cuando falla la tarjeta) y emails automáticos de "actualiza tu método de pago". Definir la política: tras X días de impago, **suspender el panel** (`active=false`) con un mensaje honesto ("tu suscripción está pausada, actualiza el pago para reactivarla"), no cortar en seco sin avisar.

4. **Cambios y bajas.** Como no hay permanencia, el cliente puede cancelar cuando quiera. Debe haber una forma clara de cancelar (link al portal de cliente de Stripe) para no dar mala imagen reteniendo a la fuerza.

5. **Reconsiderar el modelo (riesgo #1).** Sin permanencia + entrega manual en verano = churn barato. Opciones a decidir: **permanencia mínima de 3 meses**, o **setup pequeño (150-200 €)** que cubra el pico del mes 1. Con coste variable ~0, el margen aguanta; el problema es el churn, no el coste.

---

## 11) SOPORTE Y COMUNICACIÓN

1. **Canal único, no el WhatsApp personal (P1 #17).** Un email `hola@faro...` o un número dedicado que ambos vean. Si todo pasa por el móvil de Jordi y Jordi está en clase en Ho Chi Minh, el cliente se queda colgado.
2. **SLA de soporte honesto y por escrito.** Con la diferencia horaria (Ljubljana/Ho Chi Minh vs España), prometed lo que podéis cumplir: p.ej. "respondemos en 48 h laborables". Mejor prometer 48 h y cumplir que prometer "al momento" y fallar.
3. **Comunicación proactiva.** El informe mensual + el panel vivo **son** la comunicación principal; reducen las preguntas "¿qué estáis haciendo?". Un buen informe es el mejor soporte.
4. **Onboarding guiado async.** El email de bienvenida + `06-onboarding-accesos.md` con capturas evita la mayoría de dudas del arranque sin necesidad de llamada.

---

## 12) EXPECTATIVAS, PLAZOS HONESTOS Y A QUIÉN NO VENDER

### Expectativas por escrito (evita el churn del mes 2-3)
Un documento corto que el cliente recibe/firma en el onboarding, diciendo la verdad:
- **Mes 1 = setup, no ranking.** Ficha optimizada, schema, sistema de reseñas montado. Todavía no se ven saltos en el Map Pack.
- **El SEO local tarda semanas o meses** y depende de la competencia (a Mimosi no la ponemos por delante de Sivana en un mes).
- **No garantizamos el #1** (regla dura del proyecto: nada de "#1 garantizado"). Prometemos mejoras concretas: ficha completa, más reseñas goteando, mejor posición media, web con schema.
- **Qué mide el panel y qué es estimación** (las 4 KPIs grandes son estimadas hasta conectar tu Google).
- **Qué necesitamos de ti** (los accesos, y responder rápido a las peticiones del onboarding).

### A quién NO vender (cualificación/descarte, hoy no existe)
Cerrar al cliente equivocado cuesta más que no cerrarlo. Descartar (o avisar del sobrecoste/plazo) si:
- **No tiene ficha reclamable/verificable** y no está dispuesto a reclamarla (sin ficha no hay palanca #1).
- **No tiene web ni intención de tenerla** (se cae el módulo C; se le puede vender pero con expectativas recortadas).
- **Está fuera del vertical** (bienestar/clínicas de cita previa) — no sabéis entregar igual de bien en restauración o retail; no disperséis.
- **Exige garantía de #1 o resultados inmediatos** — es un churn seguro y un choque con la regla de honestidad. Mejor no cerrarlo.
- **Estáis al tope de capacidad** (8-10 / 5-6 en verano) — frenad cierres aunque el lead sea bueno.

---

## 13) SECUENCIA RECOMENDADA (qué hacer primero, dado el internship que se acerca)

Orden pensado para que lo crítico esté listo **antes** de iros y para arrancar los relojes lentos cuanto antes:

1. **Esta semana (decisiones + relojes lentos, poco código):**
   - Decidir y crear en Stripe el **precio de 190 €/mes** recurrente. Verificar payouts (identidad+IBAN).
   - Resolver la **fiscalidad** (quién factura, IVA). Bloqueante para cobrar en serio.
   - **Arrancar el trámite de la GBP API + verificación OAuth** (P2 #19-20): tarda semanas, empieza el reloj aunque no haya clientes.
   - Crear la **cuenta Google dedicada de Faro** con 2FA y meterla en un gestor de contraseñas compartido (P0 #9).
   - Adaptar las **plantillas legales** (encargo de tratamiento + expectativas) (P0 #8).

2. **Antes de cerrar a Mimosi (para no enseñarle datos de Pagadi):**
   - P0 #1, #2, #6: **quitar el baked de Pagadi** del panel y crear plan/activity por defecto.
   - Redactar `06-onboarding-accesos.md` y actualizar el guion de venta (P1 #11).

3. **En cuanto Mimosi diga que sí (cerrar el ciclo async):**
   - P0 #3: **programar el snapshot semanal en la nube** (sin esto el panel se congela en verano).
   - P0 #7: persistir leads en Supabase.
   - P1 #10: informe mensual auto (justifica la cuota del mes 1).

4. **Con 1-2 clientes de pago (automatizar lo que duela):**
   - P0 #4-#5: **webhook de Stripe** + links con metadata (alta automática de verdad).
   - P1 #13, #15, #16, #17, #18: reseñas, vista admin, dunning, soporte, runbook.

5. **Con 2-5 clientes (métricas reales):**
   - P2 #21-#23: OAuth "Conectar mi Google", KPIs reales, WhatsApp de reseñas, Search Console. Para entonces Google ya debería haber aprobado el trámite que arrancasteis en el paso 1.

**Idea rectora:** primero lo que evita mentir (panel sin Pagadi) y lo que os deja operar desde fuera (snapshot en la nube, informe auto, dunning, soporte, runbook, offboarding). Los relojes lentos de Google, arrancados ya en paralelo. Lo demás, según lo pida el primer cliente de pago.

---

### Ficheros clave citados (rutas absolutas)
- Landing y formulario: `C:\Users\jordi\OneDrive\servicio-seo-local\apps\web\index.html`, `C:\Users\jordi\OneDrive\servicio-seo-local\apps\web\api\lead.js`
- Panel de cliente: `C:\Users\jordi\OneDrive\servicio-seo-local\apps\panel\index.html`, `...\apps\panel\api\chat.js`, `...\apps\panel\schema.sql`
- Backend de datos: `C:\Users\jordi\OneDrive\servicio-seo-local\tools\audit-generator\src\lib\panel.mjs`, `...\src\panel-snapshot.mjs`, `...\src\panel-add-client.mjs`, `...\src\panel-log-activity.mjs`
- Datos públicos: `...\tools\audit-generator\src\lib\places.mjs`, `...\src\lib\message.mjs`
- Automatización nube: `C:\Users\jordi\OneDrive\servicio-seo-local\.github\workflows\daily.yml` (faltan `weekly.yml` y `monthly.yml`)
- Webhook Stripe a crear: `C:\Users\jordi\OneDrive\servicio-seo-local\apps\web\api\stripe-webhook.js` (no existe)
- Docs a crear: `...\06-onboarding-accesos.md`, `...\RUNBOOK.md`, pack legal (encargo de tratamiento + expectativas) — ninguno existe hoy