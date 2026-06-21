// variant-policy.mjs — decide CUÁNTO volumen damos a cada variante de email, con cabeza:
// no se reacciona al ruido. Hasta tener muestra suficiente → reparto IGUAL. Luego, más
// volumen a la que más RESPUESTAS POSITIVAS saca, con un suelo del 15% por variante para
// seguir explorando (no encerrarnos en una que ganó por azar).
// Métrica = respuestas clasificadas (NO aperturas, NO rebotes, NO autorespuestas).
import { VARIANTS } from "./email-copy.mjs";

export const MIN_SENDS = 120;   // envíos mínimos POR variante antes de decidir
export const MIN_REPLIES = 8;   // respuestas totales mínimas antes de decidir
export const FLOOR = 0.15;      // suelo de reparto por variante (exploración)
const POSITIVE = new Set(["interesado", "pregunta"]);

// Conteos por variante a partir del sent-log y los leads clasificados.
export function variantStats(sentLog = {}, leads = []) {
  const ids = VARIANTS.map((v) => v.id);
  const sends = Object.fromEntries(ids.map((id) => [id, 0]));
  const replies = Object.fromEntries(ids.map((id) => [id, 0]));
  const positives = Object.fromEntries(ids.map((id) => [id, 0]));
  const emailToVar = {};
  for (const v of Object.values(sentLog)) { const id = v.variant || "v1"; if (sends[id] != null) sends[id]++; if (v.to) emailToVar[String(v.to).toLowerCase()] = id; }
  for (const l of leads) { const id = emailToVar[String(l.email || "").toLowerCase()] || "v1"; if (replies[id] == null) continue; replies[id]++; if (POSITIVE.has(l.estado)) positives[id]++; }
  return { ids, sends, replies, positives };
}

// Pesos de reparto (suman 1). decided=false → reparto igual (muestra insuficiente).
export function variantWeights(sentLog = {}, leads = []) {
  const { ids, sends, replies, positives } = variantStats(sentLog, leads);
  const totalReplies = ids.reduce((s, id) => s + replies[id], 0);
  const enoughSends = ids.every((id) => sends[id] >= MIN_SENDS);
  const decided = enoughSends && totalReplies >= MIN_REPLIES;
  let weights;
  if (!decided) {
    weights = Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
  } else {
    const score = Object.fromEntries(ids.map((id) => [id, (positives[id] + 1) / (sends[id] + 2)])); // tasa positiva suavizada (Laplace)
    const sum = ids.reduce((s, id) => s + score[id], 0);
    let w = Object.fromEntries(ids.map((id) => [id, score[id] / sum]));
    w = Object.fromEntries(ids.map((id) => [id, Math.max(w[id], FLOOR)]));           // suelo 15%
    const s2 = ids.reduce((s, id) => s + w[id], 0);
    weights = Object.fromEntries(ids.map((id) => [id, w[id] / s2]));                  // renormalizar
  }
  return { weights, decided, sends, replies, positives, totalReplies };
}

// Elección ponderada (Math.random vale aquí: es un script normal, no un workflow).
export function pickVariant(weights) {
  const ids = Object.keys(weights);
  let r = Math.random();
  for (const id of ids) { r -= weights[id]; if (r <= 0) return id; }
  return ids[ids.length - 1];
}
