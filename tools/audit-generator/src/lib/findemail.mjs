// findemail.mjs — encuentra emails públicos en la web del negocio (sin Apify,
// para casos fáciles). Pide la home + páginas de contacto y extrae mailto/emails.
// Para webs con antibot o sin email visible → Apify/Scrapling (ver dataforseo/brain).
import { USER_AGENT } from "../config.mjs";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const JUNK_DOMAINS = ["example.", "sentry", "wixpress", "@2x", ".png", ".jpg", ".gif", ".svg", ".webp", "domain.com", "cloudflare", "squarespace", "wordpress", "wp.com", "googleapis", "gstatic", "schema.org", "w3.org", "jsdelivr", "googletagmanager", "cdn.", "yourdomain", "sentry.io"];
const CONTACT_PATHS = ["", "contacto", "contact", "aviso-legal"];

async function fetchText(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}

function extract(html) {
  const found = new Set();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(m[1].toLowerCase());
  for (const m of html.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (!JUNK_DOMAINS.some((j) => e.includes(j)) && e.length < 60) found.add(e);
  }
  return [...found];
}

/** @returns {Promise<{emails:string[], best:string|null}>} */
export async function findEmails(websiteUrl) {
  if (!websiteUrl) return { emails: [], best: null };
  let base;
  try {
    base = new URL(websiteUrl);
  } catch {
    return { emails: [], best: null };
  }
  const emails = new Set();
  for (const p of CONTACT_PATHS) {
    const html = await fetchText(p ? `${base.origin}/${p}` : base.origin);
    if (html) extract(html).forEach((e) => emails.add(e));
    if (emails.size >= 3) break;
  }
  const list = [...emails];
  const dom = base.hostname.replace(/^www\./, "");
  // Preferir SIEMPRE un email del propio dominio del negocio. Si no hay, un
  // email personal (gmail/hotmail — típico del dueño). NUNCA coger un dominio
  // de terceros (agencia, CDN) → mejor null que un email equivocado.
  const best =
    list.find((e) => e.endsWith("@" + dom) && /^(info|hola|contacto|contact|cita|reservas|clinica|recepcion|administracion|citaprevia)/.test(e)) ||
    list.find((e) => e.endsWith("@" + dom)) ||
    list.find((e) => /@(gmail|hotmail|yahoo|outlook|icloud|live|telefonica|movistar)\./.test(e)) ||
    null;
  return { emails: list, best };
}
