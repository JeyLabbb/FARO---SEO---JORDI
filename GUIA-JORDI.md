# Guía paso a paso — tareas de Jordi

> Lo que tienes que hacer tú (lo demás lo monta Claude). Por orden de prioridad.

---

## ✅ TAREA 1 — Activar tu Stripe para que el dinero te llegue (LA MÁS IMPORTANTE)
Los links de pago ya existen y cobran, pero hasta que actives la cuenta, Stripe retiene el dinero. 10 min:

1. Entra a **https://dashboard.stripe.com** con tu cuenta (la de "JeyLabbb").
2. Arriba verás un aviso tipo **"Activa los pagos" / "Completa tu perfil"**. Haz clic.
3. Rellena:
   - **Tipo de negocio:** Particular / Autónomo (aún no tenéis sociedad).
   - **Tus datos:** nombre, DNI/NIE, dirección, fecha de nacimiento.
   - **Sector:** "Servicios de marketing / publicidad digital".
   - **Web del negocio:** pon `https://faroseo.vercel.app`.
4. **Añade tu cuenta bancaria (IBAN)** — ahí te llegarán los pagos.
5. Envía. Stripe verifica en minutos/horas.
6. *(Para más adelante)* cuando montemos el cobro automático, necesitaré tu **clave secreta**: Developers → API keys → "Secret key". **No la pegues en sitios públicos**, me la pasas a mí cuando toque.

---

## ✅ TAREA 2 — Comprar 2-3 dominios (para el email a escala)
Cuanto antes los compres, antes empiezan a "envejecer" (hace falta para enviar emails sin que te marquen spam).

1. Entra a **https://www.namecheap.com** y crea cuenta.
2. Busca dominios **parecidos a Faro pero que NO sean tu marca principal**. Ideas:
   - `getfaro.com`, `faro-seo.com`, `hazfaro.es`, `farolocal.es`, `probarfaro.com`.
3. Compra **2-3** (los `.com` ~10-12 €/año; los `.es` algo menos).
4. En el carrito: **rechaza los extras** (hosting, SSL, etc.) — solo necesitas el dominio. Deja activado el **"Domain Privacy"** (gratis).
5. Paga. Ya está — luego les montamos los buzones (Tarea 4).
> Apúntame aquí cuáles compraste cuando los tengas.

---

## ✅ TAREA 3 — Preparar tus Gmail para enviar emails HOY
Tus cuentas con años ya están "calientes" → sirven para enviar sin esperar. Con cabeza:

1. Elige **3-4 cuentas de Gmail secundarias** (NO tu Gmail principal del día a día).
2. Asegúrate de que cada una tiene **nombre real + foto de perfil** (que parezca una persona, no un bot).
3. Instala **Mailmeteor** (gratis): https://mailmeteor.com → "Add to Gmail" en cada cuenta. *(Sirve para mandar emails personalizados en lote desde tu Gmail.)*
4. Yo te prepararé un **CSV con los contactos + el mensaje personalizado**; tú lo cargas en Mailmeteor y envías **~20-25/día por cuenta** (no más, para no quemarlas).
> Dime **cuántas Gmail** vas a usar → dimensiono los envíos.

---

## ✅ TAREA 4 — Smartlead + buzones (DESPUÉS de comprar dominios)
Esto es para el email a ESCALA (cientos/día). Tiene 2-4 semanas de "calentamiento", por eso se empieza ya pero se usa más adelante. Te guío en detalle cuando tengas los dominios, pero el resumen:

1. **Google Workspace** (https://workspace.google.com, ~6 €/usuario/mes): conecta tus dominios nuevos y crea 2-3 buzones por dominio (ej. `jordi@getfaro.com`, `jorge@getfaro.com`).
2. Configura **SPF, DKIM y DMARC** (unos registros DNS) — te paso los valores exactos.
3. En **Smartlead** (https://smartlead.ai): conecta cada buzón (te lleva por un login de Google).
4. Activa el **"Warmup"** en cada buzón y déjalo **2-4 semanas**.
5. Cuando estén calientes, cargamos la campaña y enviamos a escala.

---

## Resumen de qué me tienes que pasar a mí
- Cuando actives Stripe → (más adelante) tu **clave secreta** de Stripe.
- **Cuántas Gmail** secundarias vas a usar.
- **Qué dominios** compraste.
- La **API key de Smartlead** cuando tengas la cuenta lista.
