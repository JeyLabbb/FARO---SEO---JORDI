// qa.mjs — control de calidad por audit ANTES de enviar. Marca cada negocio con
// {pass, flags, score}. pass=false si hay algún fallo DURO (no se debe enviar).
// Los fallos blandos avisan (p.ej. personalización genérica, web caída) pero no
// bloquean — sirven para que Jordi los priorice en la pantalla de revisión.
const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Categorías/negocios que NO encajan con el producto (cita previa: bienestar/
// clínicas/estética). Si la ficha cae aquí, fuera del envío.
const BLOCK = [
  "apuesta", "casa de apuestas", "casino", "bingo", "loteria",
  "ong", "fundacion", "asociacion",
  "abogad", "abogac", "asesoria", "gestoria", "notaria",
  "inmobiliaria", "autoescuela",
  "tanatorio", "funeraria", "cementerio",
  "iglesia", "parroquia", "mezquita",
  "sex shop", "sexshop",
  "ayuntamiento", "administracion publica", "administracion de loteria",
  "colegio oficial", "colegio de", "formacion dental", "centro de formacion", "facultad", "universidad",
];

const PH_DOM = new Set(["email.com", "example.com", "example.org", "example.net", "domain.com", "dominio.com", "tudominio.com", "yourdomain.com", "test.com", "correo.com", "booksy.com", "treatwell.com", "treatwell.es", "doctoralia.com", "doctoralia.es", "topdoctors.es"]);
const PH_LOC = new Set(["tu", "tucorreo", "tusdatos", "tuemail", "tunombre", "your", "youremail", "yourname", "ejemplo", "example", "nombre", "correo", "emailaddress", "abc", "xxx", "test", "asdf", "aaa"]);
export function validEmail(raw) {
  let e; try { e = decodeURIComponent(String(raw || "")); } catch { e = String(raw || ""); }
  e = e.replace(/\s+/g, "").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return false;
  const [l, d] = e.split("@");
  return !PH_DOM.has(d) && !PH_LOC.has(l);
}

/**
 * @param {object} row  fila de audit-batch: { negocio, ciudad, vertical, email, place_id, channel, slug, findings }
 * @param {object} opts { requirePdf?:boolean, pdfExists?:boolean }
 * @returns {{pass:boolean, score:number, flags:{sev:string,msg:string}[]}}
 */
export function qaRow(row, opts = {}) {
  const f = row.findings || {};
  const flags = [];
  const hard = (m) => flags.push({ sev: "hard", msg: m });
  const soft = (m) => flags.push({ sev: "soft", msg: m });

  // Duros (bloquean el envío)
  if (!row.place_id) hard("sin place_id (no resuelto en Google)");
  if ((row.channel === "email" || row.email) && !validEmail(row.email)) hard("email inválido o placeholder");
  const hay = strip(`${row.negocio} ${row.vertical} ${f.category || ""}`);
  const hit = BLOCK.find((b) => hay.includes(strip(b)));
  if (hit) hard(`categoría vetada (${hit})`);
  if (opts.requirePdf && !opts.pdfExists) hard("falta el PDF");

  // Blandos (avisan, no bloquean)
  if (f.reviews != null && (f.reviews < 0 || f.reviews > 100000)) soft("nº de reseñas fuera de rango");
  if (f.speed != null && (f.speed < 0 || f.speed > 100)) soft("velocidad fuera de rango");
  if (f.webReachable === false) soft("la web no responde");
  if (!f.bestCompetitor) hard("sin competidor de referencia (informe flojo → a un lado)");
  if (f.hookGeneric || !f.hook) soft("personalización genérica (sin gancho propio)");

  const hardN = flags.filter((x) => x.sev === "hard").length;
  const softN = flags.filter((x) => x.sev === "soft").length;
  const score = Math.max(0, 100 - hardN * 100 - softN * 15);
  return { pass: hardN === 0, score, flags };
}
