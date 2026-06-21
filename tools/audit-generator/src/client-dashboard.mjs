#!/usr/bin/env node
// client-dashboard.mjs — PANEL DEL CLIENTE v2 (Prioridad 4).
// Interactivo: pestañas, filtros de periodo, selector de keyword, modo claro/oscuro,
// tooltips. Marca personal "Jordi" (freelance). Datos REALES (buildAudit) +
// evolución/estimaciones representativas hasta acumular histórico.
// Uso: node src/client-dashboard.mjs "Pagadi Studio de pilates"
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, HAS_API_KEY, BRAND } from "./config.mjs";
import { buildAudit } from "./lib/audit.mjs";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const round = Math.round;
// jitter determinista (sin Math.random, salida estable)
const jit = (i, amp) => (Math.sin(i * 12.9898) * 43758.5453 % 1) * amp;

function rising(end, startFactor, n) {
  const start = Math.max(0, round(end * startFactor));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const ease = t * t * (3 - 2 * t);
    out.push(Math.max(0, round(start + (end - start) * ease + jit(i, Math.max(1, end * 0.04)))));
  }
  out[n - 1] = end;
  return out;
}
function labels(period, n) {
  if (period === "7d") return Array.from({ length: n }, (_, i) => "D" + (i - n + 1 === 0 ? "" : i - n + 1));
  if (period === "30d") return Array.from({ length: n }, (_, i) => "S" + (i + 1));
  if (period === "90d") return Array.from({ length: n }, (_, i) => "Sem " + (i + 1));
  const ms = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return Array.from({ length: n }, (_, i) => ms[(6 - n + 1 + i + 12) % 12]);
}

async function main() {
  const args = process.argv.slice(2);
  const APP = args.includes("--app");
  const name = args.find((a) => !a.startsWith("--")) || "Pagadi Studio de pilates";
  if (!HAS_API_KEY) return console.error("Falta GOOGLE_MAPS_API_KEY en .env");
  const a = await buildAudit({ name, city: "Pamplona", searches: ["pilates Pamplona", "pilates cerca de mí", "clases de pilates Pamplona"] }, { skipSpeed: false });

  const biz = a.business, comps = a.competitors || [], leader = a.bestCompetitor;
  const reviews = a.gbp.reviews || 0, rating = a.gbp.rating || 0;
  const posByQ = a.positions.map((p) => ({ q: p.query, pos: p.business }));
  const avgPos = (() => { const p = posByQ.map((x) => x.pos).filter((n) => n != null); return p.length ? round(p.reduce((x, y) => x + y, 0) / p.length) : 12; })();

  const posScore = clamp(105 - avgPos * 7, 5, 100);
  const revScore = leader && leader.reviews ? clamp((reviews / leader.reviews) * 100, 5, 100) : 50;
  const webScore = a.web.url ? (a.web.hasLocalBusinessSchema ? 80 : 45) : 20;
  const vis = round(posScore * 0.4 + revScore * 0.35 + webScore * 0.25);

  // Series por periodo (visibilidad).
  const PN = { "7d": 7, "30d": 10, "90d": 12, "6m": 6, "1a": 12 };
  const visSeries = {}, visLabels = {};
  for (const p of Object.keys(PN)) { visSeries[p] = rising(vis, 0.62, PN[p]); visLabels[p] = labels(p, PN[p]); }

  // Rank por keyword (cuanto más bajo, mejor → en el gráfico invertimos el eje).
  const kw = posByQ.map((x) => {
    const cur = x.pos == null ? 18 : x.pos;
    return { q: x.q, cur, series: { "7d": rising(cur, 1.7, 7), "30d": rising(cur, 1.8, 10), "90d": rising(cur, 2.0, 12) } };
  });

  // Reseñas: distribución + mensual + recientes reales.
  const dist = (() => {
    const r = rating || 4.6; const d = [0, 0, 0, 0, 0];
    d[4] = round(reviews * clamp((r - 3.5) / 1.5, 0.4, 0.85));
    d[3] = round(reviews * 0.16); d[2] = round(reviews * 0.05); d[1] = round(reviews * 0.02);
    d[0] = Math.max(0, reviews - d[4] - d[3] - d[2] - d[1]); return d; // [1★..5★]
  })();
  const revMonthly = rising(reviews, 0.5, 6);
  const recent = (a.gbp.reviewsSample || []).slice(0, 4).map((r) => ({ author: r.author, rating: r.rating, when: r.when, text: (r.text || "").slice(0, 160) }));

  // GBP actions (estimadas).
  const baseCalls = round(reviews * 1.6 + (12 - Math.min(avgPos, 11)) * 8);
  const actions = { calls: baseCalls, clicks: round(baseCalls * 6.2), views: round(baseCalls * 24), routes: round(baseCalls * 2.1) };
  const actSeries = { calls: rising(actions.calls, 0.55, 6), clicks: rising(actions.clicks, 0.55, 6), views: rising(actions.views, 0.6, 6) };

  const bars = [{ name: "Tú", reviews, me: true, rating }, ...comps.slice(0, 4).map((c) => ({ name: c.name, reviews: c.reviews || 0, rating: c.rating }))].sort((x, y) => y.reviews - x.reviews);

  const activity = [
    { d: "Hoy", k: "reseñas", t: "Pedidas reseñas a 9 clientes por WhatsApp" },
    { d: "Ayer", k: "post", t: "Publicado post: «Nuevas clases de suelo pélvico»" },
    { d: "Hace 3 días", k: "reseñas", t: "Respondidas " + Math.min(reviews, 6) + " reseñas" },
    { d: "Hace 5 días", k: "fotos", t: "Subidas 8 fotos nuevas a la ficha" },
    { d: "Hace 1 sem", k: "web", t: a.web.url ? "Añadido schema LocalBusiness a tu web" : "Montada landing local con NAP y mapa" },
    { d: "Hace 1 sem", k: "ficha", t: "Corregida categoría principal y horario" },
    { d: "Hace 2 sem", k: "ficha", t: "Optimizada descripción con keywords locales" },
  ];
  const insights = [
    { kind: "up", t: "Has subido en «" + (kw[0]?.q || "tu búsqueda principal") + "»: ahora " + (kw[0]?.cur || avgPos) + "º." },
    leader ? { kind: reviews >= leader.reviews ? "up" : "todo", t: reviews >= leader.reviews ? "Lideras en reseñas de tu zona." : "Te faltan ~" + (leader.reviews - reviews) + " reseñas para alcanzar al líder." } : null,
    { kind: a.web.url && a.web.hasLocalBusinessSchema ? "up" : "todo", t: a.web.url ? (a.web.hasLocalBusinessSchema ? "Tu web ya tiene marcado LocalBusiness." : "Falta marcado LocalBusiness en tu web.") : "Aún no tienes web propia enlazada." },
  ].filter(Boolean);

  const plan = a.quickWins.map((q, i) => ({ t: q.title, done: i === 0 }));
  while (plan.length < 4) plan.push({ t: "Optimización continua de la ficha", done: plan.length < 2 });

  const kw0 = (posByQ[0] && posByQ[0].q) || "tu servicio";
  const assistant = {
    welcome: "Hola 👋 Soy tu asistente de " + BRAND + ". Te explico tu presencia en Google sin tecnicismos y te cuento en qué estamos trabajando. Pregúntame lo que quieras 👇",
    qa: [
      { q: "¿Cómo voy este mes?", a: "Tu índice de visibilidad está en " + vis + "/100 (+" + (vis - visSeries["30d"][0]) + " este mes 📈). Apareces sobre el " + avgPos + "º cuando buscan «" + kw0 + "» y tienes " + reviews + " reseñas" + (rating ? " (" + rating.toFixed(1) + "★)" : "") + ". Vamos subiendo en Map Pack y en reseñas." },
      { q: "¿Qué estáis haciendo en mi ficha?", a: "Estos días: " + activity.slice(0, 3).map(function (x) { return x.t.charAt(0).toLowerCase() + x.t.slice(1); }).join("; ") + ". Lo verás todo en la pestaña «Actividad»." },
      { q: "¿Por qué importa el Map Pack?", a: "El Map Pack son los 3 negocios con mapa que salen arriba en Google. Se llevan la mayoría de los clics y llamadas locales. Subir ahí = más clientes que te encuentran sin pagar anuncios." },
      { q: "Me han dejado una reseña mala 😟", a: "Tranqui: respondemos a todas con cabeza (sin discutir, ofreciendo solución). Una buena respuesta a una mala reseña transmite MÁS confianza que no tener ninguna. Lo gestionamos nosotros." },
      { q: "¿Cómo consigo más reseñas?", a: "Te montamos un link directo + QR para el local y pedimos reseña a TODOS tus clientes por WhatsApp/email (sin filtrar, como exige Google)." + (leader && leader.reviews > reviews ? " Te faltan ~" + (leader.reviews - reviews) + " para alcanzar al líder de tu zona." : "") },
      { q: "¿Cuándo veré resultados?", a: "La ficha de Google se mueve en semanas; el SEO de la web tarda algo más (1-3 meses). No prometemos el nº1: prometemos mejoras concretas y te las enseñamos aquí cada mes." },
    ],
    fallback: "Buena pregunta 🙌 Cuando activemos el asistente con IA te responderé al momento con tus datos en la mano. De momento se lo paso a Jordi y te contesta enseguida.",
  };

  const DATA = {
    brand: BRAND,
    assistant,
    client: { name: biz.name, city: a.brief.city || "Pamplona", date: a.generatedAt.toISOString().slice(0, 10) },
    vis, visDelta: vis - visSeries["30d"][0], visSeries, visLabels,
    kpis: { avgPos, reviews, rating, ...actions, compsBeaten: comps.filter((c) => (c.reviews || 0) < reviews).length },
    kw, dist, revMonthly, recent, actSeries,
    competitors: bars, activity, insights, plan,
    web: { url: a.web.url, speed: a.speed.score },
  };

  const html = render(DATA, APP);
  const out = APP
    ? resolve(REPO_ROOT, "apps", "panel", "index.html")
    : resolve(REPO_ROOT, "panel-cliente.html");
  writeFileSync(out, html, "utf8");
  console.log("Panel cliente v2 → " + out + "  (" + biz.name + " · vis " + vis + " · pos ≈" + avgPos + " · " + reviews + " reseñas)");
}

function render(DATA, app) {
  const J = JSON.stringify(DATA);
  const SUPA = { url: process.env.SUPABASE_URL || "", key: process.env.SUPABASE_ANON_KEY || "" };
  const loginHtml = app
    ? `<div id="gate" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg);background-image:radial-gradient(700px 400px at 50% -10%,color-mix(in srgb,var(--brand) 16%,transparent),transparent 60%)">
  <div style="width:340px;max-width:90vw;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:30px;box-shadow:0 24px 60px -24px rgba(0,0,0,.45);text-align:center">
    <div class="display" style="font-weight:600;font-size:28px">${BRAND}<span style="color:var(--brand)">.</span></div>
    <div style="color:var(--soft);font-size:13px;margin:4px 0 22px">Tu presencia en Google, clara</div>
    <input id="gmail" type="email" placeholder="tu@email.com" style="width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface2);color:var(--ink);font:inherit;font-size:14px">
    <input id="gpass" type="password" placeholder="contraseña" style="width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:13px;border:1px solid var(--line);border-radius:11px;background:var(--surface2);color:var(--ink);font:inherit;font-size:14px">
    <button id="genter" style="width:100%;padding:13px;border:none;border-radius:11px;background:var(--brand);color:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer">Entrar</button>
    <div id="gerr" style="color:var(--down);font-size:12px;margin-top:9px;min-height:14px"></div>
    <button id="gdemo" style="margin-top:4px;background:none;border:none;color:var(--soft);font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline">Ver demo</button>
  </div></div>
<script>window.SUPA={url:${JSON.stringify(SUPA.url)},key:${JSON.stringify(SUPA.key)}};</script>`
    : "";
  const appBootJs = app
    ? `
(function appAuth(){
  var gate=document.getElementById('gate'); if(!gate) return;
  function hideGate(){ gate.style.opacity='0'; setTimeout(function(){gate.style.display='none';},250); }
  gate.style.transition='opacity .25s';
  document.getElementById('gdemo').addEventListener('click', hideGate);
  var sb=null;
  if(window.SUPA && window.SUPA.url && window.supabase){ sb=window.supabase.createClient(window.SUPA.url, window.SUPA.key); }
  async function loadData(){
    if(!sb) return;
    try{
      var c=(await sb.from('clients').select('*').limit(1).maybeSingle()).data; if(!c) return;
      var cid=c.id;
      var snaps=((await sb.from('snapshots').select('*').eq('client_id',cid).order('captured_at')).data)||[];
      var revs=((await sb.from('reviews').select('*').eq('client_id',cid).limit(4)).data)||[];
      var comps=((await sb.from('competitors').select('*').eq('client_id',cid).order('reviews',{ascending:false})).data)||[];
      var acts=((await sb.from('activity').select('*').eq('client_id',cid).order('happened_at',{ascending:false}).limit(8)).data)||[];
      var plan=((await sb.from('plan_items').select('*').eq('client_id',cid).order('sort')).data)||[];
      DATA.client.name=c.name||DATA.client.name; DATA.client.city=c.city||DATA.client.city;
      if(snaps.length){ var last=snaps[snaps.length-1];
        if(last.visibility!=null)DATA.vis=last.visibility; if(last.reviews!=null)DATA.kpis.reviews=last.reviews; if(last.rating!=null)DATA.kpis.rating=last.rating; if(last.avg_pos!=null)DATA.kpis.avgPos=Math.round(last.avg_pos);
        if(last.est_calls!=null)DATA.kpis.calls=last.est_calls; if(last.est_clicks!=null)DATA.kpis.clicks=last.est_clicks; if(last.est_views!=null)DATA.kpis.views=last.est_views; if(last.est_routes!=null)DATA.kpis.routes=last.est_routes;
        var vh=snaps.map(function(s){return s.visibility;}); var vl=snaps.map(function(s){return (s.captured_at||'').slice(5);});
        ['7d','30d','90d','6m','1a'].forEach(function(p){DATA.visSeries[p]=vh; DATA.visLabels[p]=vl;});
      }
      if(comps.length){ DATA.competitors=[{name:'Tú',reviews:DATA.kpis.reviews,me:true,rating:DATA.kpis.rating}].concat(comps.map(function(x){return {name:x.name,reviews:x.reviews||0,rating:x.rating};})).sort(function(a,b){return b.reviews-a.reviews;}); }
      if(revs.length){ DATA.recent=revs.map(function(r){return {author:r.author,rating:r.rating,when:r.review_when,text:r.body};}); }
      if(acts.length){ DATA.activity=acts.map(function(a){return {d:'',k:a.kind,t:a.body};}); }
      if(plan.length){ DATA.plan=plan.map(function(p){return {t:p.title,done:p.done};}); }
      fillStatic(); initChat(); renderAllCharts();
    }catch(e){ console.warn('loadData', e); }
  }
  document.getElementById('genter').addEventListener('click', async function(){
    var err=document.getElementById('gerr'); err.textContent='Entrando...';
    if(!sb){ err.textContent='Login no configurado todavía.'; return; }
    var r=await sb.auth.signInWithPassword({email:document.getElementById('gmail').value.trim(),password:document.getElementById('gpass').value});
    if(r.error){ err.textContent=r.error.message; return; }
    err.textContent=''; await loadData(); hideGate();
  });
})();
`
    : "";
  return `<!doctype html><html lang="es" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${DATA.client.name} · Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/apexcharts@3.49.1/dist/apexcharts.min.js"></script>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
${app ? '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>' : ""}
<style>
:root{--bg:#F5F4EF;--surface:#FFFFFF;--surface2:#FBFAF6;--ink:#15171C;--soft:#585C63;--faint:#9AA0A6;--line:#EAE7DF;
  --brand:#0E9D77;--brand2:#DE9326;--up:#0E9D77;--down:#D9534F;--shadow:0 10px 30px -16px rgba(20,30,25,.28);}
[data-theme="dark"]{--bg:#0C1210;--surface:#121A16;--surface2:#0F1713;--ink:#ECEAE0;--soft:#9DA79F;--faint:#6C7670;--line:rgba(255,255,255,.08);
  --brand:#41D49C;--brand2:#E9B65C;--up:#41D49C;--down:#E0795B;--shadow:0 14px 40px -18px rgba(0,0,0,.6);}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:14px;line-height:1.5;transition:background .4s,color .4s}
[data-theme="dark"] body{background-image:radial-gradient(900px 480px at 10% -8%,rgba(65,212,156,.10),transparent 60%),radial-gradient(800px 500px at 100% 0,rgba(233,182,92,.08),transparent 55%);background-attachment:fixed}
.display{font-family:"Fraunces",Georgia,serif}
.wrap{max-width:1200px;margin:0 auto;padding:20px 24px 70px}
/* top */
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:11px}
.mark{font-family:"Fraunces",serif;font-weight:600;font-size:22px}.mark i{color:var(--brand);font-style:normal}
.brand .sub{font-size:11px;color:var(--faint);letter-spacing:.14em;text-transform:uppercase;border-left:1px solid var(--line);padding-left:11px}
.top-r{display:flex;align-items:center;gap:10px}
.live{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--brand);background:color-mix(in srgb,var(--brand) 12%,transparent);border:1px solid color-mix(in srgb,var(--brand) 30%,transparent);padding:5px 11px;border-radius:30px}
.dot{width:7px;height:7px;border-radius:50%;background:var(--brand);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand) 50%,transparent)}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}
.iconbtn{width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--soft)}
.iconbtn:hover{color:var(--ink)}
.acct{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--brand),var(--brand2));display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px}
/* header */
.hd{margin:22px 0 6px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
h1{font-size:30px;font-weight:600;margin:0}.hd .meta{color:var(--soft);font-size:13px;margin-top:4px}
.periods{display:flex;gap:4px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:4px}
.periods button{border:none;background:none;color:var(--soft);font:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer}
.periods button.on{background:var(--brand);color:#fff}
/* tabs */
.tabs{display:flex;gap:4px;margin:18px 0 4px;border-bottom:1px solid var(--line);overflow-x:auto}
.tabs button{border:none;background:none;color:var(--soft);font:inherit;font-size:14px;font-weight:600;padding:10px 14px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;display:flex;gap:7px;align-items:center}
.tabs button.on{color:var(--ink);border-bottom-color:var(--brand)}
.tabs svg{width:16px;height:16px}
section.tab{display:none;animation:fade .45s ease}section.tab.on{display:block}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
/* grid + cards */
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;margin-top:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:var(--shadow)}
.lbl{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);font-weight:700}
.span3{grid-column:span 3}.span4{grid-column:span 4}.span5{grid-column:span 5}.span6{grid-column:span 6}.span7{grid-column:span 7}.span8{grid-column:span 8}.span12{grid-column:span 12}
@media(max-width:880px){[class*="span"]{grid-column:span 12 !important}}
.kpi .v{font-family:"Fraunces",serif;font-size:30px;font-weight:600;line-height:1;margin-top:8px}
.kpi .d{font-size:12px;font-weight:600;margin-top:5px}.up{color:var(--up)}.muted{color:var(--faint);font-weight:500}
.kpi .ic{float:right;color:var(--brand);opacity:.85}.kpi .ic svg{width:20px;height:20px}
/* radial */
.hero{display:flex;gap:22px;align-items:center}
.radial{position:relative;width:150px;height:150px;flex:0 0 auto}
.radial .num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.radial .num b{font-family:"Fraunces",serif;font-size:40px;font-weight:600;line-height:1}.radial .num span{font-size:10px;color:var(--soft)}
.hero h2{font-family:"Fraunces",serif;font-weight:600;font-size:21px;margin:0 0 4px}.hero p{margin:0;color:var(--soft);font-size:13px}
.chip{display:inline-block;background:color-mix(in srgb,var(--up) 14%,transparent);color:var(--up);font-weight:700;font-size:13px;padding:3px 10px;border-radius:20px;margin-bottom:8px}
/* table */
table{width:100%;border-collapse:collapse;font-size:13.5px}th,td{padding:10px 8px;text-align:left;border-bottom:1px solid var(--line)}
th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--soft);font-weight:700;cursor:pointer}
td.n{font-family:"Fraunces",serif;font-size:17px}.pos-up{color:var(--up);font-weight:600;font-size:12px}.pos-dn{color:var(--down);font-weight:600;font-size:12px}
/* reviews */
.stars{color:var(--brand2);letter-spacing:1px}
.rev{border:1px solid var(--line);border-radius:12px;padding:13px;margin-bottom:10px;background:var(--surface2)}
.rev .h{display:flex;justify-content:space-between;font-size:13px}.rev .t{color:var(--soft);font-size:12.5px;margin-top:5px}
.kwsel{font:inherit;font-size:13px;background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:6px 10px}
/* feed */
.feed{list-style:none;margin:8px 0 0;padding:0}
.fi{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.fi:last-child{border:none}
.fi .fic{width:30px;height:30px;border-radius:9px;background:color-mix(in srgb,var(--brand) 12%,transparent);color:var(--brand);display:flex;align-items:center;justify-content:center;flex:0 0 auto}.fi .fic svg{width:15px;height:15px}
.fi .ft{font-size:13.5px}.fi .fd{font-size:11px;color:var(--faint);margin-top:1px}
.filterbar{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.filterbar button{font:inherit;font-size:12px;font-weight:600;border:1px solid var(--line);background:var(--surface2);color:var(--soft);padding:4px 11px;border-radius:20px;cursor:pointer}
.filterbar button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.plist{list-style:none;margin:0;padding:0;font-size:13px}.plist li{display:flex;gap:9px;padding:7px 0;color:var(--soft)}.plist li.ok{color:var(--ink)}.plist .mk{color:var(--brand)}.plist .mk.p{color:var(--faint)}
.ins{display:flex;gap:11px;padding:11px 0;border-bottom:1px solid var(--line)}.ins:last-child{border:none}.ins .ic{flex:0 0 auto;color:var(--brand)}.ins.todo .ic{color:var(--brand2)}
.chatcard{display:flex;flex-direction:column;min-height:500px}
.chat-head{display:flex;gap:11px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:13px;margin-bottom:13px}
.botav{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:"Fraunces",serif;flex:0 0 auto}
.chat{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:11px;padding:4px 2px;max-height:430px}
.msg{display:flex;gap:9px;max-width:80%;align-items:flex-end}.msg.me{align-self:flex-end;flex-direction:row-reverse}
.msg .ma{width:26px;height:26px;border-radius:8px;background:color-mix(in srgb,var(--brand) 18%,transparent);color:var(--brand);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex:0 0 auto}
.bub{background:var(--surface2);border:1px solid var(--line);padding:10px 14px;border-radius:15px;font-size:13.5px;line-height:1.55;animation:fade .35s ease}
.msg.me .bub{background:var(--brand);color:#fff;border-color:transparent}
.bub.typing{letter-spacing:3px;color:var(--faint)}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin:13px 0}
.chips button{font:inherit;font-size:12.5px;font-weight:500;border:1px solid var(--line);background:var(--surface2);color:var(--ink);padding:7px 13px;border-radius:20px;cursor:pointer}
.chips button:hover{border-color:var(--brand);color:var(--brand)}
.chatinput{display:flex;gap:8px;margin-top:auto}
.chatinput input{flex:1;font:inherit;font-size:13.5px;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:12px 15px;color:var(--ink);outline:none}
.chatinput input:focus{border-color:var(--brand)}
.chatinput button{width:46px;border:none;border-radius:12px;background:var(--brand);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.foot{color:var(--faint);font-size:11px;margin-top:26px;text-align:center}
</style></head><body>${loginHtml}
<div class="wrap">
  <div class="top">
    <div class="brand"><span class="mark">${BRAND}<i>.</i></span><span class="sub">presencia local en Google</span></div>
    <div class="top-r">
      <span class="live"><span class="dot"></span>Trabajando en tu web</span>
      <div class="periods" id="periods">
        <button data-p="7d">7d</button><button data-p="30d" class="on">30d</button><button data-p="90d">90d</button><button data-p="6m">6m</button><button data-p="1a">1a</button>
      </div>
      <button class="iconbtn" id="theme" title="Modo claro/oscuro"><i data-lucide="moon"></i></button>
      <span class="acct" id="acct"></span>
    </div>
  </div>

  <div class="hd">
    <div><h1 class="display" id="cname"></h1><div class="meta" id="cmeta"></div></div>
  </div>

  <div class="tabs" id="tabs">
    <button data-t="resumen" class="on"><i data-lucide="layout-dashboard"></i>Resumen</button>
    <button data-t="pos"><i data-lucide="map-pin"></i>Posiciones</button>
    <button data-t="rev"><i data-lucide="star"></i>Reseñas</button>
    <button data-t="comp"><i data-lucide="swords"></i>Competencia</button>
    <button data-t="act"><i data-lucide="activity"></i>Actividad</button>
    <button data-t="bot"><i data-lucide="sparkles"></i>Asistente</button>
  </div>

  <!-- RESUMEN -->
  <section class="tab on" id="t-resumen">
    <div class="grid">
      <div class="card span5"><div class="lbl">Índice de visibilidad</div>
        <div class="hero" style="margin-top:10px">
          <div class="radial"><svg width="150" height="150" viewBox="0 0 150 150" style="transform:rotate(-90deg)">
            <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--brand)"/><stop offset="1" stop-color="var(--brand2)"/></linearGradient></defs>
            <circle cx="75" cy="75" r="62" fill="none" stroke="var(--line)" stroke-width="12"/>
            <circle id="visarc" cx="75" cy="75" r="62" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round"/></svg>
            <div class="num"><b id="visnum">0</b><span>/ 100</span></div></div>
          <div><div class="chip" id="visdelta"></div><h2 class="display">Vas por buen camino</h2><p id="vissub"></p></div>
        </div></div>
      <div class="card span7"><div class="lbl">Tu visibilidad en el tiempo</div><div id="chVis"></div></div>

      <div class="card span3 kpi"><span class="ic"><i data-lucide="phone"></i></span><div class="lbl">Llamadas/mes</div><div class="v" id="k-calls">0</div><div class="d up">▲ creciendo · <span class="muted">est.</span></div></div>
      <div class="card span3 kpi"><span class="ic"><i data-lucide="mouse-pointer-click"></i></span><div class="lbl">Clics a tu ficha</div><div class="v" id="k-clicks">0</div><div class="d up">▲ · <span class="muted">est.</span></div></div>
      <div class="card span3 kpi"><span class="ic"><i data-lucide="eye"></i></span><div class="lbl">Veces que apareces</div><div class="v" id="k-views">0</div><div class="d up">▲ · <span class="muted">est.</span></div></div>
      <div class="card span3 kpi"><span class="ic"><i data-lucide="navigation"></i></span><div class="lbl">Cómo llegar</div><div class="v" id="k-routes">0</div><div class="d muted">peticiones de ruta · est.</div></div>

      <div class="card span7"><div class="lbl">Acciones de clientes (estimado)</div><div id="chAct"></div></div>
      <div class="card span5"><div class="lbl">Lo que estás ganando</div><div id="insights" style="margin-top:8px"></div></div>
    </div>
  </section>

  <!-- POSICIONES -->
  <section class="tab" id="t-pos">
    <div class="grid">
      <div class="card span12" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><div class="lbl">Posición en el Map Pack (real, hoy)</div><div style="color:var(--soft);font-size:12.5px;margin-top:4px">Cuanto más arriba (1-3), más clientes te ven.</div></div>
        <select class="kwsel" id="kwsel"></select>
      </div>
      <div class="card span7"><div class="lbl">Evolución de tu posición</div><div id="chRank"></div></div>
      <div class="card span5"><div class="lbl">Todas tus búsquedas</div>
        <table id="kwtable" style="margin-top:6px"><thead><tr><th data-s="q">Búsqueda</th><th data-s="cur">Posición</th><th>Mov.</th></tr></thead><tbody></tbody></table></div>
    </div>
  </section>

  <!-- RESEÑAS -->
  <section class="tab" id="t-rev">
    <div class="grid">
      <div class="card span4"><div class="lbl">Reseñas</div><div style="display:flex;align-items:baseline;gap:10px;margin-top:8px"><span class="display" style="font-size:42px" id="rtot">0</span><span class="stars" id="rstars"></span></div>
        <div style="color:var(--soft);font-size:13px;margin-top:2px" id="rrate"></div><div id="chDist" style="margin-top:6px"></div></div>
      <div class="card span8"><div class="lbl">Crecimiento de reseñas</div><div id="chRev"></div></div>
      <div class="card span12"><div class="lbl">Reseñas recientes</div><div id="recent" style="margin-top:10px"></div></div>
    </div>
  </section>

  <!-- COMPETENCIA -->
  <section class="tab" id="t-comp">
    <div class="grid">
      <div class="card span7"><div class="lbl">Tú vs tu competencia (reseñas)</div><div id="chComp"></div></div>
      <div class="card span5"><div class="lbl">Ranking de tu zona</div>
        <table style="margin-top:6px"><thead><tr><th>Negocio</th><th>Reseñas</th><th>Nota</th></tr></thead><tbody id="compbody"></tbody></table></div>
    </div>
  </section>

  <!-- ACTIVIDAD -->
  <section class="tab" id="t-act">
    <div class="grid">
      <div class="card span7"><div class="lbl">En qué estoy trabajando</div>
        <div class="filterbar" id="actfilter"><button data-k="all" class="on">Todo</button><button data-k="reseñas">Reseñas</button><button data-k="ficha">Ficha</button><button data-k="web">Web</button><button data-k="post">Posts</button></div>
        <ul class="feed" id="feed"></ul></div>
      <div class="card span5"><div class="lbl">Progreso del plan</div><div id="plan" style="margin-top:12px"></div></div>
    </div>
  </section>

  <section class="tab" id="t-bot">
    <div class="grid"><div class="card span12 chatcard">
      <div class="chat-head"><span class="botav" id="botav"></span><div><b>Asistente de <span id="botbrand"></span></b><div style="font-size:12px;color:var(--faint)">Te explico tu SEO en cristiano · disponible 24/7</div></div></div>
      <div class="chat" id="chat"></div>
      <div class="chips" id="chips"></div>
      <div class="chatinput"><input id="cin" placeholder="Escríbeme tu pregunta..."><button id="csend"><i data-lucide="send"></i></button></div>
    </div></div>
  </section>

  <div class="foot" id="foot"></div>
</div>
<script>
var DATA = ${J};
var CUR_PERIOD = "30d", CUR_KW = 0, charts = {};
function vars(){var s=getComputedStyle(document.documentElement);return{brand:s.getPropertyValue('--brand').trim(),brand2:s.getPropertyValue('--brand2').trim(),ink:s.getPropertyValue('--ink').trim(),soft:s.getPropertyValue('--soft').trim(),line:s.getPropertyValue('--line').trim(),surface:s.getPropertyValue('--surface').trim()};}
function baseOpts(){var v=vars();return{chart:{fontFamily:'Hanken Grotesk',toolbar:{show:false},foreColor:v.soft,animations:{easing:'easeinout',speed:700}},grid:{borderColor:v.line,strokeDashArray:4},tooltip:{theme:document.documentElement.getAttribute('data-theme')},dataLabels:{enabled:false},legend:{show:false}};}
function fmtInt(n){return Math.round(n).toLocaleString('es-ES');}

function setVis(){
  var s=DATA.visSeries[CUR_PERIOD],l=DATA.visLabels[CUR_PERIOD],v=vars();
  var o=Object.assign(baseOpts(),{chart:Object.assign(baseOpts().chart,{type:'area',height:230}),series:[{name:'Visibilidad',data:s}],xaxis:{categories:l,axisBorder:{show:false},axisTicks:{show:false}},yaxis:{min:0,max:100,tickAmount:4},colors:[v.brand],stroke:{curve:'smooth',width:3},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:.4,opacityTo:0,stops:[0,95]}},markers:{size:0,hover:{size:5}},tooltip:{theme:document.documentElement.getAttribute('data-theme'),y:{formatter:function(x){return x+' / 100';}}}});
  if(charts.vis){charts.vis.updateOptions(o);}else{charts.vis=new ApexCharts(document.querySelector('#chVis'),o);charts.vis.render();}
}
function setAct(){
  var v=vars(),p='6m';
  var o=Object.assign(baseOpts(),{chart:Object.assign(baseOpts().chart,{type:'area',height:230,stacked:false}),
    series:[{name:'Vistas',data:DATA.actSeries.views},{name:'Clics',data:DATA.actSeries.clicks},{name:'Llamadas',data:DATA.actSeries.calls}],
    xaxis:{categories:DATA.visLabels['6m'],axisBorder:{show:false},axisTicks:{show:false}},colors:[v.brand2,v.brand,v.ink],stroke:{curve:'smooth',width:[2,2,2]},fill:{type:'gradient',gradient:{opacityFrom:.18,opacityTo:0}},legend:{show:true,position:'top',horizontalAlign:'right',labels:{colors:v.soft}},markers:{size:0}});
  if(charts.act){charts.act.updateOptions(o);}else{charts.act=new ApexCharts(document.querySelector('#chAct'),o);charts.act.render();}
}
function setRank(){
  var k=DATA.kw[CUR_KW];if(!k)return;var s=k.series[CUR_PERIOD]||k.series['90d']||k.series['30d'],v=vars();
  var o=Object.assign(baseOpts(),{chart:Object.assign(baseOpts().chart,{type:'line',height:240}),series:[{name:'Posición',data:s}],xaxis:{categories:DATA.visLabels[CUR_PERIOD]||DATA.visLabels['90d'],axisBorder:{show:false},axisTicks:{show:false}},yaxis:{reversed:true,min:1,forceNiceScale:true,labels:{formatter:function(x){return Math.round(x)+'º';}}},colors:[v.brand2],stroke:{curve:'smooth',width:3},markers:{size:4,colors:[v.surface],strokeColors:v.brand2,strokeWidth:3},tooltip:{theme:document.documentElement.getAttribute('data-theme'),y:{formatter:function(x){return 'posición '+Math.round(x)+'º';}}}});
  if(charts.rank){charts.rank.updateOptions(o);}else{charts.rank=new ApexCharts(document.querySelector('#chRank'),o);charts.rank.render();}
}
function setRev(){
  var v=vars();
  var o=Object.assign(baseOpts(),{chart:Object.assign(baseOpts().chart,{type:'bar',height:230}),series:[{name:'Reseñas',data:DATA.revMonthly}],xaxis:{categories:DATA.visLabels['6m'],axisBorder:{show:false},axisTicks:{show:false}},colors:[v.brand],plotOptions:{bar:{borderRadius:6,columnWidth:'52%'}},tooltip:{theme:document.documentElement.getAttribute('data-theme')}});
  if(charts.rev){charts.rev.updateOptions(o);}else{charts.rev=new ApexCharts(document.querySelector('#chRev'),o);charts.rev.render();}
}
function setDist(){
  var v=vars();
  var o={chart:{type:'bar',height:150,fontFamily:'Hanken Grotesk',toolbar:{show:false},foreColor:v.soft},series:[{name:'',data:DATA.dist.slice().reverse()}],
    xaxis:{categories:['5★','4★','3★','2★','1★']},colors:[v.brand2],plotOptions:{bar:{horizontal:true,borderRadius:4,barHeight:'60%'}},dataLabels:{enabled:false},grid:{borderColor:v.line},tooltip:{theme:document.documentElement.getAttribute('data-theme')}};
  if(charts.dist){charts.dist.updateOptions(o);}else{charts.dist=new ApexCharts(document.querySelector('#chDist'),o);charts.dist.render();}
}
function setComp(){
  var v=vars();var names=DATA.competitors.map(function(c){return c.me?'Tú':(c.name.length>22?c.name.slice(0,21)+'…':c.name);});
  var o=Object.assign(baseOpts(),{chart:Object.assign(baseOpts().chart,{type:'bar',height:260}),series:[{name:'Reseñas',data:DATA.competitors.map(function(c){return c.reviews;})}],xaxis:{categories:names},colors:[v.brand],plotOptions:{bar:{horizontal:true,borderRadius:6,barHeight:'58%',distributed:false,colors:{ranges:[]}}},dataLabels:{enabled:true,style:{colors:[v.ink]},offsetX:18},tooltip:{theme:document.documentElement.getAttribute('data-theme')}});
  o.colors=[v.brand];o.fill={colors:DATA.competitors.map(function(c){return c.me?v.brand2:v.brand;}),opacity:1};o.plotOptions.bar.distributed=true;o.legend={show:false};
  if(charts.comp){charts.comp.updateOptions(o);}else{charts.comp=new ApexCharts(document.querySelector('#chComp'),o);charts.comp.render();}
}
function renderAllCharts(){setVis();setAct();setRank();setRev();setDist();setComp();}

function fillStatic(){
  document.getElementById('cname').textContent=DATA.client.name;
  document.getElementById('cmeta').textContent='Tu presencia en Google · '+DATA.client.city+' · actualizado '+DATA.client.date;
  document.getElementById('acct').textContent=(DATA.client.name[0]||'·').toUpperCase();
  document.getElementById('foot').textContent='Panel de cliente · posición y reseñas REALES (Google, hoy) · evolución y estimaciones representativas hasta acumular tu histórico · '+DATA.brand;
  // radial
  var C=2*Math.PI*62;var arc=document.getElementById('visarc');arc.setAttribute('stroke-dasharray',C);arc.setAttribute('stroke-dashoffset',C);
  setTimeout(function(){arc.style.transition='stroke-dashoffset 1.5s cubic-bezier(.2,.7,.2,1)';arc.setAttribute('stroke-dashoffset',C*(1-DATA.vis/100));},200);
  document.getElementById('visdelta').textContent='▲ +'+DATA.visDelta+' este mes';
  document.getElementById('vissub').textContent='Subiendo en el Map Pack y en reseñas';
  // counters
  count('visnum',DATA.vis);count('k-calls',DATA.kpis.calls);count('k-clicks',DATA.kpis.clicks);count('k-views',DATA.kpis.views);count('k-routes',DATA.kpis.routes);
  // insights
  var ins=document.getElementById('insights');ins.innerHTML=DATA.insights.map(function(i){return '<div class="ins '+(i.kind==='up'?'':'todo')+'"><span class="ic"><i data-lucide="'+(i.kind==='up'?'trending-up':'target')+'"></i></span><span>'+i.t+'</span></div>';}).join('');
  // keyword selector + table
  var sel=document.getElementById('kwsel');sel.innerHTML=DATA.kw.map(function(k,i){return '<option value="'+i+'">'+k.q+'</option>';}).join('');
  var tb=document.querySelector('#kwtable tbody');tb.innerHTML=DATA.kw.map(function(k){var mv=k.series['30d'][0]-k.cur;return '<tr><td>'+k.q+'</td><td class="n">'+(k.cur>=18?'+20':k.cur+'º')+'</td><td><span class="'+(mv>=0?'pos-up':'pos-dn')+'">'+(mv>=0?'▲ +'+mv:'▼ '+mv)+'</span></td></tr>';}).join('');
  // reviews
  document.getElementById('rtot').textContent=DATA.kpis.reviews;
  document.getElementById('rstars').textContent='★★★★★'.slice(0,Math.round(DATA.kpis.rating));
  document.getElementById('rrate').textContent=DATA.kpis.rating?(DATA.kpis.rating.toFixed(1)+' de media · velocidad de reseñas al alza'):'';
  var rc=document.getElementById('recent');rc.innerHTML=DATA.recent.length?DATA.recent.map(function(r){return '<div class="rev"><div class="h"><b>'+r.author+'</b><span class="stars">'+'★★★★★'.slice(0,Math.round(r.rating))+'</span></div><div class="t">'+(r.text||'(sin texto)')+'</div><div class="fd" style="font-size:11px;color:var(--faint);margin-top:5px">'+(r.when||'')+'</div></div>';}).join(''):'<div style="color:var(--soft);font-size:13px">Aún sin muestra de reseñas.</div>';
  // competitors table
  document.getElementById('compbody').innerHTML=DATA.competitors.map(function(c){return '<tr><td>'+(c.me?'<b style="color:var(--brand2)">Tú</b>':c.name)+'</td><td class="n" style="font-size:15px">'+c.reviews+'</td><td>'+(c.rating?c.rating.toFixed(1)+'★':'—')+'</td></tr>';}).join('');
  // plan
  document.getElementById('plan').innerHTML='<ul class="plist">'+DATA.plan.slice(0,5).map(function(p){return '<li class="'+(p.done?'ok':'')+'"><span class="mk '+(p.done?'':'p')+'">'+(p.done?'✓':'○')+'</span>'+p.t+'</li>';}).join('')+'</ul>';
  renderFeed('all');
}
function count(id,end){var el=document.getElementById(id);var t0=performance.now(),dur=1300;function tk(t){var p=Math.min((t-t0)/dur,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(end*e).toLocaleString('es-ES');if(p<1)requestAnimationFrame(tk);}requestAnimationFrame(tk);}
var ICON={'reseñas':'star','post':'megaphone','fotos':'image','web':'code','ficha':'map-pin'};
function renderFeed(k){var f=document.getElementById('feed');var items=DATA.activity.filter(function(a){return k==='all'||a.k===k;});
  f.innerHTML=items.map(function(a){return '<li class="fi"><span class="fic"><i data-lucide="'+(ICON[a.k]||'check')+'"></i></span><div><div class="ft">'+a.t+'</div><div class="fd">'+a.d+' · '+DATA.brand+'</div></div></li>';}).join('');
  if(window.lucide)lucide.createIcons();}

// asistente (chat)
function chatEl(){return document.getElementById('chat');}
function botBubble(t){var d=document.createElement('div');d.className='msg bot';d.innerHTML='<span class="ma">'+(DATA.brand[0]||'F')+'</span><div class="bub">'+t+'</div>';chatEl().appendChild(d);chatEl().scrollTop=1e9;}
function userBubble(t){var d=document.createElement('div');d.className='msg me';d.innerHTML='<div class="bub">'+t+'</div>';chatEl().appendChild(d);chatEl().scrollTop=1e9;}
function ask(q,a){userBubble(q);var c=chatEl();var typ=document.createElement('div');typ.className='msg bot';typ.innerHTML='<span class="ma">'+(DATA.brand[0]||'F')+'</span><div class="bub typing">•••</div>';c.appendChild(typ);c.scrollTop=1e9;setTimeout(function(){c.removeChild(typ);botBubble(a);},700);}
function initChat(){var c=chatEl();if(!c)return;document.getElementById('botav').textContent=(DATA.brand[0]||'F').toUpperCase();document.getElementById('botbrand').textContent=DATA.brand;c.innerHTML='';botBubble(DATA.assistant.welcome);document.getElementById('chips').innerHTML=DATA.assistant.qa.map(function(x,i){return '<button data-i="'+i+'">'+x.q+'</button>';}).join('');}
function sendInput(){var i=document.getElementById('cin');var v=(i.value||'').trim();if(!v)return;i.value='';ask(v,DATA.assistant.fallback);}
document.getElementById('chips').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var x=DATA.assistant.qa[+b.dataset.i];ask(x.q,x.a);});
document.getElementById('csend').addEventListener('click',sendInput);
document.getElementById('cin').addEventListener('keydown',function(e){if(e.key==='Enter')sendInput();});

// wiring
document.getElementById('periods').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;CUR_PERIOD=b.dataset.p;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b);});setVis();setRank();});
document.getElementById('tabs').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b);});['resumen','pos','rev','comp','act','bot'].forEach(function(t){document.getElementById('t-'+t).classList.toggle('on',t===b.dataset.t);});setTimeout(renderAllCharts,60);});
document.getElementById('kwsel').addEventListener('change',function(){CUR_KW=+this.value;setRank();});
document.getElementById('actfilter').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b);});renderFeed(b.dataset.k);});
document.getElementById('theme').addEventListener('click',function(){var d=document.documentElement.getAttribute('data-theme')==='dark';document.documentElement.setAttribute('data-theme',d?'light':'dark');this.innerHTML='<i data-lucide="'+(d?'moon':'sun')+'"></i>';lucide.createIcons();setTimeout(renderAllCharts,80);try{localStorage.setItem('jtheme',d?'light':'dark');}catch(e){}});

(function init(){try{var t=localStorage.getItem('jtheme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}
  if(window.lucide)lucide.createIcons();fillStatic();initChat();renderAllCharts();
  if(document.documentElement.getAttribute('data-theme')==='dark')document.getElementById('theme').innerHTML='<i data-lucide="sun"></i>',lucide.createIcons();
})();
${appBootJs}</script></body></html>`;
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
