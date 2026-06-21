// config.mjs — carga de entorno (sin dependencias) y constantes del proyecto.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
// Raíz del repo (donde viven los .md del proyecto y la carpeta targets/).
export const REPO_ROOT = resolve(ROOT, "..", "..");

/**
 * Carga un .env de forma manual (sin dependencias). No sobreescribe variables
 * ya definidas → el PRIMERO que se cargue gana.
 */
function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Quita comillas envolventes si las hay.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Secretos: PRIMERO `~/.faro/.env` (fuera de OneDrive, no se sincroniza a la
 * nube → tiene prioridad); luego el `.env` del repo (compatibilidad / no
 * secretos). Si no existe ninguno, el generador funciona en modo demo.
 */
function loadEnv() {
  loadEnvFile(resolve(homedir(), ".faro", ".env"));
  loadEnvFile(resolve(ROOT, ".env"));
}
loadEnv();

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
export const PAGESPEED_API_KEY =
  process.env.PAGESPEED_API_KEY || GOOGLE_MAPS_API_KEY || "";

/** ¿Tenemos clave para datos reales? Si no, el CLI cae a modo demo. */
export const HAS_API_KEY = Boolean(GOOGLE_MAPS_API_KEY);

// Ciudades conocidas -> centro para el "locationBias" de Places.
// Puedes añadir lat/lng directamente en el brief para cualquier otra zona.
export const CITIES = {
  pamplona: { lat: 42.8125, lng: -1.6458, radius: 12000 },
  iruña: { lat: 42.8125, lng: -1.6458, radius: 12000 },
  navarra: { lat: 42.8125, lng: -1.6458, radius: 30000 },
  burlada: { lat: 42.8289, lng: -1.6206, radius: 8000 },
  barañáin: { lat: 42.8047, lng: -1.6747, radius: 8000 },
  zizur: { lat: 42.7853, lng: -1.6889, radius: 8000 },
  tudela: { lat: 42.0648, lng: -1.6064, radius: 12000 },
};

/** Resuelve la zona del brief a un centro/radio para sesgar la búsqueda. */
export function resolveLocationBias(brief) {
  if (brief.lat != null && brief.lng != null) {
    return { lat: brief.lat, lng: brief.lng, radius: brief.radius || 12000 };
  }
  const key = String(brief.city || "pamplona")
    .toLowerCase()
    .trim();
  return CITIES[key] || CITIES.pamplona;
}

// Idioma/región por defecto para las llamadas a Google.
export const LANGUAGE_CODE = "es";
export const REGION_CODE = "ES";

// Nombre de producto que ve el cliente (placeholder). CÁMBIALO AQUÍ y se
// actualiza en todo: audits, panel y mensajes. Sin referencias a MTRYX.
export const BRAND = "Faro";

// User-Agent honesto al pedir la web propia del cliente (no scrapeamos SERPs).
export const USER_AGENT = `${BRAND}-AuditBot/0.1 (+auditoría SEO local)`;
