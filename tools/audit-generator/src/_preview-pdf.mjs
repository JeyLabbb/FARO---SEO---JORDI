// _preview-pdf.mjs — escribe un audit de EJEMPLO (datos ilustrativos) con el
// diseño actual de render.mjs, para revisar el look antes de generar de verdad.
//   node src/_preview-pdf.mjs   → apps/web/audits/_ejemplo-rojo.html
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { mockAudit } from "./mock.mjs";
import { renderHtml } from "./lib/render.mjs";

const a = mockAudit();
a.brief.name = a.business.name = "Clínica Dental Aribau";
a.brief.city = "Barcelona";
a.business.category = a.gbp.category = "Clínica dental";
a.business.rating = a.gbp.rating = 4.3; a.business.reviews = a.gbp.reviews = 34;
a.gbp.lastReviewWhen = "hace 2 meses"; a.gbp.photosCount = 5;
a.brief.searches = a.searches = ["dentista Barcelona", "clínica dental Eixample", "implantes dentales Barcelona"];
a.competitors = [
  { name: "Clínica Dental Pardiñas", rating: 4.8, reviews: 212 },
  { name: "Dental Corium", rating: 4.7, reviews: 96 },
  { name: "Venindent", rating: 4.6, reviews: 70 },
];
a.bestCompetitor = { name: "Clínica Dental Pardiñas", rating: 4.8, reviews: 212 };
a.positions = [
  { query: "dentista Barcelona", business: 7, competitors: [{ name: "Clínica Dental Pardiñas", pos: 1 }, { name: "Dental Corium", pos: 3 }, { name: "Venindent", pos: 5 }] },
  { query: "clínica dental Eixample", business: 4, competitors: [{ name: "Clínica Dental Pardiñas", pos: 1 }, { name: "Dental Corium", pos: 2 }, { name: "Venindent", pos: 6 }] },
  { query: "implantes dentales Barcelona", business: null, competitors: [{ name: "Clínica Dental Pardiñas", pos: 2 }, { name: "Dental Corium", pos: 4 }, { name: "Venindent", pos: null }] },
];
a.mapPackReal = true;
a.web.url = "https://www.clinicadentalaribau.es";
a.web.title = "Clínica Dental Aribau | Dentista en Barcelona";
a.web.hasLocalBusinessSchema = false; a.web.hasLocalKeywordInTitleOrH1 = true; a.web.hasPhone = true; a.web.hasEmbeddedMap = false;
a.speed.score = 38; a.speed.lcp = "4.6 s";
a.quickWins = [
  { title: "Arrancar una campaña de reseñas", detail: "Tienes 34 reseñas frente a las 212 del referente de la zona. Pedir reseña a cada paciente con link directo + QR en recepción." },
  { title: "Optimizar la ficha para lo que de verdad buscan", detail: "Categorías, servicios y descripción afinados a «dentista Barcelona» e «implantes», que es lo que teclea quien va a pedir cita." },
  { title: "Acelerar la web en móvil", detail: "Va a 38/100 en PageSpeed: además de espantar visitas, Google lo usa para ordenar." },
];
a.notes = [];

const html = renderHtml(a);
const out = resolve(REPO_ROOT, "apps", "web", "audits", "_ejemplo-rojo.html");
writeFileSync(out, html, "utf8");
console.log("HTML de ejemplo escrito:", out);
