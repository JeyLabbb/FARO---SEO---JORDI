// mock.mjs — datos de ejemplo para el modo demo (--demo). No llama a ninguna
// API: construye un objeto de auditoría con la MISMA forma que buildAudit(),
// para poder ver el formato del informe sin clave de Google.
export function mockAudit() {
  const brief = {
    name: "Auraa Estudio Pilates",
    city: "Pamplona",
    searches: ["pilates Pamplona", "pilates suelo pélvico Pamplona", "pilates cerca de mí"],
  };
  return {
    generatedAt: new Date(),
    brief,
    business: {
      id: "DEMO_AURAA",
      name: "Auraa Estudio Pilates",
      rating: 4.8,
      reviews: 37,
      primaryType: "pilates_studio",
      category: "Estudio de Pilates",
      types: ["pilates_studio", "gym", "point_of_interest"],
      website: "https://www.ejemplo-auraa.es",
    },
    competitors: [
      { id: "C1", name: "Reforma Pilates Iruña", rating: 4.9, reviews: 128, category: "Estudio de Pilates", website: "https://ejemplo1.es" },
      { id: "C2", name: "Core Studio Pamplona", rating: 4.7, reviews: 61, category: "Gimnasio", website: "https://ejemplo2.es" },
      { id: "C3", name: "Pilates Yoga Center", rating: 4.6, reviews: 44, category: "Estudio de yoga", website: "https://ejemplo3.es" },
    ],
    bestCompetitor: { id: "C1", name: "Reforma Pilates Iruña", rating: 4.9, reviews: 128 },
    positions: [
      { query: "pilates Pamplona", business: 5, competitors: [{ name: "Reforma Pilates Iruña", pos: 1 }, { name: "Core Studio Pamplona", pos: 3 }, { name: "Pilates Yoga Center", pos: 4 }] },
      { query: "pilates suelo pélvico Pamplona", business: 2, competitors: [{ name: "Reforma Pilates Iruña", pos: 1 }, { name: "Core Studio Pamplona", pos: null }, { name: "Pilates Yoga Center", pos: 6 }] },
      { query: "pilates cerca de mí", business: 8, competitors: [{ name: "Reforma Pilates Iruña", pos: 2 }, { name: "Core Studio Pamplona", pos: 5 }, { name: "Pilates Yoga Center", pos: null }] },
    ],
    searches: brief.searches,
    web: {
      url: "https://www.ejemplo-auraa.es",
      reachable: true,
      title: "Auraa | Estudio de Pilates",
      h1: "Bienvenida a Auraa",
      hasLocalBusinessSchema: false,
      schemaTypes: ["organization"],
      hasViewport: true,
      hasEmbeddedMap: false,
      hasPhone: true,
      hasLocalKeywordInTitleOrH1: false,
      error: null,
    },
    speed: { score: 41, lcp: "4.2 s", cls: "0.02" },
    gbp: {
      category: "Estudio de Pilates",
      primaryType: "pilates_studio",
      secondaryTypes: ["gym", "point_of_interest"],
      photosCount: 6,
      hasHours: true,
      reviews: 37,
      rating: 4.8,
      lastReviewWhen: "hace 3 meses",
      reviewsSample: [
        { rating: 5, author: "María G.", when: "hace 3 meses", text: "Trato genial y clases muy cuidadas." },
      ],
      mapsUri: "https://maps.google.com/?cid=demo",
    },
    quickWins: [
      { weight: 8, title: "Arrancar una campaña de reseñas", detail: "Tienes 37 reseñas vs 128 del mejor competidor (Reforma Pilates Iruña). Pedir a todos los clientes con link/QR." },
      { weight: 7, title: "Meter keyword local en el title y el H1 de la web", detail: "Ni el título ni el H1 incluyen la ciudad/servicio objetivo. Es barato y mueve." },
      { weight: 7, title: "Subir fotos a la ficha (y de forma regular)", detail: "Se ven ~6 fotos. Más fotos = más clics, llamadas y rutas." },
    ],
    notes: [
      "MODO DEMO: datos inventados para ver el formato. Pon tu GOOGLE_MAPS_API_KEY en .env para datos reales.",
      "Competidores auto-detectados de la búsqueda \"pilates Pamplona\". Revisa que sean comparables.",
    ],
  };
}
