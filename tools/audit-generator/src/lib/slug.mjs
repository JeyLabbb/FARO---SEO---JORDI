// slug.mjs — utilidades de texto pequeñas y sin dependencias.

/** "Auraa Pilates" -> "auraa-pilates" (para nombres de archivo). */
export function slugify(text) {
  return String(text || "negocio")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "negocio";
}

/** Quita acentos y baja a minúsculas, para comparar texto de forma laxa. */
export function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Fecha local YYYY-MM-DD (sin librerías). */
export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
