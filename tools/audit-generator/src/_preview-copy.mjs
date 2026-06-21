// _preview-copy.mjs — muestra los 4 mensajes (inicial + 3 seguimientos) con datos
// de ejemplo coherentes con el PDF, para revisar el tono estilo Jorge.
import { subject, bodyText, followupSubject, followupBody } from "./lib/email-copy.mjs";

function show(titulo, f, negocio, ciudad) {
  console.log(`\n████████ ${titulo} ████████`);
  console.log(`ASUNTO: ${subject(f, negocio, ciudad)}`);
  console.log(`\n── INICIAL (con PDF adjunto) ──\n${bodyText(f, negocio, ciudad)}`);
  for (const n of [1, 2, 3]) {
    console.log(`\n── SEGUIMIENTO ${n}  ·  asunto: ${followupSubject(f, negocio, ciudad)} ──\n${followupBody(n, f, negocio, ciudad)}`);
  }
}

// Caso A: va por detrás, competidor con nombre (lo del PDF de ejemplo)
show("VA POR DETRÁS (competidor con nombre)", {
  reviews: 34, rating: 4.3,
  bestCompetitor: { name: "Clínica Dental Pardiñas", reviews: 212, rating: 4.8 },
  compNamed: true, posMeasured: true, avgPos: 6, businessRanked: true,
  businessVisibility: 28, competitorVisibility: 82,
  speed: 38, photos: 5, hasHours: true, quickWins: [], primarySearch: "dentista Barcelona",
}, "Clínica Dental Aribau", "Barcelona");

// Caso B: lidera (rama honesta — no decimos que va por detrás)
show("LIDERA (rama honesta)", {
  reviews: 160, rating: 4.8,
  bestCompetitor: { name: "Clínica Dental Pardiñas", reviews: 120, rating: 4.6 },
  compNamed: true, posMeasured: true, avgPos: 2, businessRanked: true,
  businessVisibility: 86, competitorVisibility: 80,
  speed: 72, photos: 18, hasHours: true, quickWins: [], primarySearch: "fisioterapia Pamplona",
}, "Fisio Centro Iruña", "Pamplona");
