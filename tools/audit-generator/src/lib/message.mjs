// message.mjs — mensajes de outreach personalizados, "valor primero":
// no preguntamos "¿os interesa?", entregamos el análisis y ofrecemos montarlo.
//
// Honestidad: solo datos reales (posición aprox, reseñas, web, horario). Sin
// "nº1 garantizado". NO afirmamos que Auraa sea de Pamplona (está en Venezuela).

import { BRAND } from "../config.mjs";

/** Cláusula-gancho concreta (lo que les duele), 1-2 hallazgos. */
export function hookClause(s) {
  const where = s.searchHint ? `cuando se busca "${s.searchHint}"` : "en Google";
  const hooks = [];
  if (!s.hasWeb && s.reviews >= 80)
    hooks.push("tenéis muchísimas reseñas pero vuestra web no aparece en Google");
  else if (!s.hasWeb) hooks.push("no tenéis web propia enlazada en la ficha");
  if (s.avgPos != null && s.avgPos >= 6)
    hooks.push(`${where} aparecéis sobre el puesto ${s.avgPos}, por detrás de la competencia`);
  if (s.leaderReviews != null && s.reviews > 0 && s.reviews < s.leaderReviews * 0.7)
    hooks.push(`tenéis ${s.reviews} reseñas frente a ~${s.leaderReviews} del líder de la zona`);
  if (s.hasHours === false) hooks.push("la ficha está incompleta (sin horario)");
  const pick = hooks.slice(0, 2);
  return pick.length
    ? pick.join(" y ")
    : "hay 3 cosas en vuestra ficha que se pueden mejorar para captar más clientes";
}

/** WhatsApp / DM — valor primero (se envía + se adjunta el PDF justo después). */
export function buildWhatsApp(s) {
  return (
    `Hola! Somos Jordi y Jorge, de ${BRAND} (Pamplona) 👋 Os hemos hecho **gratis** ` +
    `un mini-análisis de vuestra presencia en Google y ${hookClause(s)}. ` +
    `Os lo dejamos aquí 👇, sin compromiso. Si os encaja, os lo montamos nosotros ` +
    `(precio fijo, sin permanencia). ¡Un saludo!`
  );
}

/** Email — valor primero, con baja (compliance). Devuelve {subject, body}. */
export function buildEmail(s) {
  const subject = `${s.name}: 3 cosas que os están costando clientes en Google`;
  const body =
    `Hola,\n\n` +
    `Somos Jordi y Jorge, de ${BRAND} (Pamplona). Hacemos posicionamiento local en Google para clínicas y estudios.\n\n` +
    `Os hemos preparado **gratis** un análisis de vuestra presencia en Google: ${hookClause(s)}. ` +
    `Lo tenéis adjunto en 1 página, sin compromiso.\n\n` +
    `Si os encaja, os lo dejamos montado (ficha optimizada, sistema de reseñas y SEO de vuestra web) — precio fijo, sin permanencia.\n\n` +
    `¿Le echáis un ojo y nos decís?\n\n` +
    `Jordi y Jorge — ${BRAND}\n\n` +
    `— Si no quieres recibir más correos, responde "BAJA" y no te volvemos a escribir.`;
  return { subject, body };
}

/** Link wa.me con el mensaje pre-escrito. Escapa ( ) para no romper el Markdown. */
export function waLink(phone, text) {
  if (!phone) return null;
  const num = String(phone).replace(/[^\d]/g, "");
  if (!num) return null;
  const enc = encodeURIComponent(text).replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `https://wa.me/${num}?text=${enc}`;
}

// Compatibilidad: buildMessage = versión WhatsApp.
export const buildMessage = buildWhatsApp;
