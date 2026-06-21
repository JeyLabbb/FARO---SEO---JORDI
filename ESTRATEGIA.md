# Faro — Estrategia completa de captación (multicanal, por orden)

> Objetivo: maximizar conversión total sin huecos, empezando a generar dinero YA
> mientras se monta la máquina de escala en paralelo. Actualizado 2026-06-05.

---

## 0. La verdad que ordena todo: PARALELO, no secuencial

Para **cerrar y dar de alta al primer cliente NO hace falta** terminar Stripe, Smartlead ni pulir el panel. Ya tenemos:
- Audit profesional (PDF + link). ✅
- Panel demo que funciona. ✅
- Alta de cliente a mano (script). ✅
- Cobro: link de pago de Stripe (se crea en 20 min) o Bizum/transferencia para los primeros. ✅

Stripe automático, Smartlead y el pulido del panel **dan ESCALA, no el primer cierre.** Por eso:
- **Track Venta** (empieza HOY): llamadas + email bajo volumen + DMs.
- **Track Máquina** (lo monto en paralelo esta semana/3 sem): dominios → warm-up → Smartlead, Stripe automático, pulido panel.
- **No se espera al Track Máquina para empezar a vender.** Secuencial = cero ingresos este mes.

---

## 1. El embudo (igual en todos los canales)
Toque (multicanal) → **audit gratis** → llamada/videollamada con demo del panel → **cierre** (con garantía) → alta a mano → entrega → panel.

---

## 2. Los canales (completos, sin huecos)

| # | Canal | Cuándo | Quién | Volumen seguro | Riesgo |
|---|---|---|---|---|---|
| 1 | **Teléfono** | HOY | Jordi+Jorge | 150-300 llamadas/día | Ninguno. **El motor.** |
| 2 | **Email bajo volumen** (cuenta secundaria) | HOY-mañana | Jordi+Jorge | **15-25/buzón/día** | Google suspende cuentas de cold email → usar **dominio/cuenta secundaria, NO el principal**; emails verificados (rebotes >3% = blacklist) |
| 3 | **Email a escala** (Smartlead + dominios calentados) | ~3 semanas | Claude monta, ellos supervisan | cientos/día | Bajo si se calienta |
| 4 | **Instagram DM** | HOY | Jordi+Jorge | **20-30/día/cuenta** | Cold DM = causa nº1 de baneo IG → personalizar, repartir |
| 5 | **WhatsApp** | HOY | Jordi+Jorge | **20-30/día** | Baneo si masivo desde personal |
| 6 | **Formulario de su web** | HOY | Claude prepara, ellos pegan | medio | Bajo |
| 7 | **LinkedIn** | Opcional | Jordi+Jorge | ~20 invitaciones/día | Bajo ROI en estas verticales (sáltalo salvo grupos dentales) |

**Verdad incómoda:** el email (incluso bajo volumen) NO es gratis — arriesga la cuenta que envía y necesita emails verificados. El teléfono no tiene ninguno de esos problemas. Por eso el teléfono es la prioridad de HOY y el email el complemento.

---

## 3. La cadencia multicanal (el "sin huecos")

Investigado: **3+ canales = +287% de resultados**; espaciar canales 2-3 días; 4-9 toques en ~30 días para PYMEs. Por cada lead bueno (ej. dental):

- **Día 1:** Llamada. Si no cogen → WhatsApp corto.
- **Día 2:** Email con el audit (link).
- **Día 4:** DM de Instagram (suave).
- **Día 6-7:** 2ª llamada.
- **Día 10:** Email de seguimiento ("¿lo viste?").
- **Día 14:** Último toque (WhatsApp/IG).
- Parar tras ~5-6 toques si no responde.

Un lead tocado por 3 canales convierte MUchísimo más que una sola llamada. Esto es maximizar de verdad.

---

## 4. Quién hace qué

**Claude (autónomo):**
- Genera los audits (PDF + link alojado).
- Escribe TODO el copy personalizado por lead: gancho de llamada, email, DM IG, WhatsApp, mensaje de formulario.
- Construye las listas por canal (teléfono para llamar, web para formularios, etc.).
- Monta/termina: Stripe (pago→alta), Smartlead, pulido del panel.
- Envía emails **transaccionales** (mandar el audit a quien lo pide, onboarding) vía Brevo — eso SÍ es legítimo.

**Jordi + Jorge (humano):**
- El envío en frío real (llamar, emails bajo volumen, DMs, WhatsApp) desde sus cuentas/números.
- Comprar dominios + crear cuenta Stripe.
- Las videollamadas, cerrar y dar de alta.

> Por qué Claude no auto-envía el email en frío: hacerlo por la API (Brevo) viola sus términos para frío + quema el dominio + entrega fatal. Claude PREPARA; ellos envían (o Smartlead cuando esté caliente).

---

## 5. El orden de ejecución (paso por paso)

**Paso 1 — HOY (en paralelo):**
- Jordi+Jorge: **llamar** con `llamadas-HOY.csv` + `guion-llamadas.md`. Comprar 2-3 dominios. Crear cuenta de Stripe.
- Claude: **alojar audits** + **pre-generar los audits** de la lista + escribir el **copy de email/DM/WhatsApp**.

**Paso 2 — esta semana:**
- Claude: montar **Stripe** (pago→crea acceso al panel) + **pulir panel** (cron del robot, gráficas reales, vista admin).
- Jordi+Jorge: seguir llamando + email bajo volumen desde cuenta secundaria + DMs. Cerrar los primeros.

**Paso 3 — ~3 semanas (cuando los dominios estén calientes):**
- Claude: scrapear+verificar emails de los 5.000 + campaña en **Smartlead** → email a escala.

---

## 6. Lo brutalmente honesto (recordatorio)
- **No terminamos todo antes de vender.** Eso mata el mes. Paralelo.
- **El email no es magia:** arriesga la cuenta + necesita emails limpios. Calls primero.
- **No quemar dominios a lo tonto:** un dominio quemado no es más rápido, solo pierdes las 3 semanas de warm-up.
- **El cuello sigue siendo cerrar + ENTREGAR** (sois 2). Multicanal sube los leads, no tu capacidad de entrega. No vendas más de lo que podéis entregar bien.
- **€10k este mes = stretch.** Esto maximiza el tiro; el primer cliente que paga en días es lo realista.

**Fuentes:** [Topo (límites email)](https://www.topo.io/blog/safe-sending-limits-cold-email) · [Prospeo (Workspace cold email)](https://prospeo.io/s/google-workspace-cold-email) · [Woodpecker (multicanal)](https://woodpecker.co/blog/multi-channel-outreach/) · [Outreaches (benchmarks)](https://outreaches.ai/blog/cold-outreach-benchmarks) · [respond.io (WhatsApp)](https://respond.io/blog/whatsapp-business-banned) · [CreatorFlow (IG)](https://creatorflow.so/blog/avoid-instagram-bans-dm-automation/)
