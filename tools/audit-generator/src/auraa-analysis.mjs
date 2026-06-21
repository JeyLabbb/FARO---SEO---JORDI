#!/usr/bin/env node
// auraa-analysis.mjs — recopila datos SEO de aauramvmnt.com (Auraa, Venezuela)
// vía DataForSEO (backlinks + Labs keywords/competidores) + análisis técnico
// propio (on-page, velocidad) + ficha de Google. Vuelca un JSON para el informe.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./config.mjs";
import { analyzeWebsite } from "./lib/website.mjs";
import { mobileSpeed } from "./lib/pagespeed.mjs";
import { findEmails } from "./lib/findemail.mjs";
import { resolvePlace, placeDetails } from "./lib/places.mjs";

const LOGIN = process.env.DATAFORSEO_LOGIN || "";
const PASS = process.env.DATAFORSEO_PASSWORD || "";
const auth = "Basic " + Buffer.from(LOGIN + ":" + PASS).toString("base64");
async function dfs(path, task) {
  try {
    const r = await fetch("https://api.dataforseo.com/v3" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify([task]),
    });
    const d = await r.json().catch(() => ({}));
    const t = d.tasks && d.tasks[0];
    if (!t || t.status_code >= 40000) return { error: (t && t.status_message) || "HTTP " + r.status };
    return (t.result && t.result[0]) || { empty: true };
  } catch (e) {
    return { error: e.message };
  }
}

const target = "aauramvmnt.com";
const site = "https://www.aauramvmnt.com";
const VE = 2862; // location_code Venezuela
const out = { target, generatedAt: new Date().toISOString() };

const [web, speed, emails] = await Promise.all([
  analyzeWebsite(site, { city: "Venezuela", keywords: ["pilates", "movement", "caracas"] }),
  mobileSpeed(site),
  findEmails(site),
]);
out.web = web;
out.speed = speed;
out.emails = emails;

out.backlinks = await dfs("/backlinks/summary/live", { target, internal_list_limit: 5, backlinks_status_type: "live" });
out.refdomains = await dfs("/backlinks/referring_domains/live", { target, limit: 15, order_by: ["rank,desc"], backlinks_status_type: "live" });
out.domainOverview = await dfs("/dataforseo_labs/google/domain_rank_overview/live", { target, location_code: VE, language_code: "es" });
out.rankedKw = await dfs("/dataforseo_labs/google/ranked_keywords/live", { target, location_code: VE, language_code: "es", limit: 40, order_by: ["ranked_serp_element.serp_item.rank_group,asc"] });
out.competitors = await dfs("/dataforseo_labs/google/competitors_domain/live", { target, location_code: VE, language_code: "es", limit: 8 });

try {
  const f = (await resolvePlace("Aaura Movement", "Caracas Venezuela", null)) ||
    (await resolvePlace("Auraa pilates", "Venezuela", null));
  if (f) out.gbp = await placeDetails(f.id);
} catch (e) {
  out.gbpErr = e.message;
}

writeFileSync(resolve(ROOT, "audits", "_auraa-data.json"), JSON.stringify(out, null, 2), "utf8");
const bl = out.backlinks || {};
console.log(
  "web:", web.reachable, "| title:", (web.title || "").slice(0, 50),
  "| speed:", speed.score,
  "| schema:", web.hasLocalBusinessSchema,
  "\nbacklinks:", bl.backlinks, "· refdomains:", bl.referring_domains, "· dfs_rank:", bl.rank,
  "\nrankedKw:", out.rankedKw?.total_count ?? out.rankedKw?.items?.length ?? out.rankedKw?.error,
  "\norganic overview:", out.domainOverview?.items ? JSON.stringify(out.domainOverview.items[0]?.metrics?.organic) : out.domainOverview?.error,
  "\ncompetitors:", out.competitors?.items?.length ?? out.competitors?.error,
  "\ngbp:", out.gbp?.displayName?.text || out.gbpErr || "no encontrada"
);
