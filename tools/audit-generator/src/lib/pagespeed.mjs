// pagespeed.mjs — PageSpeed Insights API (oficial, gratis con cuota).
// Devuelve la nota de rendimiento en móvil (0-100) de la web del cliente.
import { PAGESPEED_API_KEY } from "../config.mjs";

const ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/**
 * @param {string} url  URL de la web del cliente.
 * @returns {Promise<{score:number|null, lcp:string|null, cls:string|null, error?:string}>}
 */
export async function mobileSpeed(url) {
  if (!url) return { score: null, lcp: null, cls: null, error: "sin web" };
  const params = new URLSearchParams({
    url,
    strategy: "mobile",
    category: "performance",
  });
  if (PAGESPEED_API_KEY) params.set("key", PAGESPEED_API_KEY);

  try {
    // PageSpeed puede tardar 10-30s; le damos margen.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        score: null,
        lcp: null,
        cls: null,
        error: data?.error?.message || `HTTP ${res.status}`,
      };
    }
    const cats = data?.lighthouseResult?.categories;
    const audits = data?.lighthouseResult?.audits || {};
    const score =
      cats?.performance?.score != null
        ? Math.round(cats.performance.score * 100)
        : null;
    return {
      score,
      lcp: audits["largest-contentful-paint"]?.displayValue || null,
      cls: audits["cumulative-layout-shift"]?.displayValue || null,
    };
  } catch (err) {
    return {
      score: null,
      lcp: null,
      cls: null,
      error: err.name === "AbortError" ? "timeout" : err.message,
    };
  }
}
