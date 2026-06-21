// build-ops.mjs — genera el CENTRO DE OPERACIONES de Faro (panel admin).
// Lee las 3 listas (LLAMADAS, WHATSAPP, EMAIL), ordenadas por PRIORIDAD, y monta
// un dashboard con: estado por negocio, botones (Llamar / Guión de venta / Abrir
// WhatsApp / Ver PDF), buscador, filtros y estadísticas. Marca "✅ Enviado" en
// orden según se envía (lee sent-log.json). El mensaje de WhatsApp y el guión de
// llamada se generan con los DATOS REALES del negocio.
//   node src/build-ops.mjs   → apps/ops/index.html
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { slugify, today } from "./lib/slug.mjs";
import { waText, waTextGeneric, igText } from "./lib/email-copy.mjs";

const PASSWORD = "faro2026";
function parseCsv(t) {
  const rows = []; const lines = t.split(/\r?\n/).filter(Boolean);
  const split = (line) => { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; };
  const head = split(lines[0]);
  for (const l of lines.slice(1)) { const c = split(l); const r = {}; head.forEach((h, i) => (r[h] = c[i])); rows.push(r); }
  return rows;
}
const read = (name) => { const p = resolve(REPO_ROOT, "targets", `${name}-${today()}.csv`); return existsSync(p) ? parseCsv(readFileSync(p, "utf8")) : []; };
const slug = (neg, ciu) => slugify(`${neg}-${ciu}`).slice(0, 60);
const pdf = (neg, ciu) => `https://faroseo.vercel.app/audits/${slug(neg, ciu)}.pdf`;
const auditsDir = resolve(REPO_ROOT, "apps", "web", "audits");
const pdfReady = (neg, ciu) => existsSync(resolve(auditsDir, `${slug(neg, ciu)}.pdf`));
const waMe = (tel, text) => `https://wa.me/${(tel || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;

// sent-log.json: lo escribe send-emails.mjs al enviar. { "<place_id>": {channel,at,to} }
const sentLog = (() => { const p = resolve(REPO_ROOT, "targets", "sent-log.json"); try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {}; } catch { return {}; } })();
// findings de hoy (para el mensaje de WhatsApp con datos reales).
// Merge de findings de TODAS las tandas (envios-HOY-*.json) → cada negocio conserva sus datos aunque cambie el día.
const findById = (() => { const m = new Map(); try { const dir = resolve(REPO_ROOT, "targets"); for (const f of readdirSync(dir).filter((x) => /^envios-HOY-.*\.json$/.test(x)).sort()) { try { for (const r of JSON.parse(readFileSync(resolve(dir, f), "utf8"))) if (r.place_id) m.set(r.place_id, r); } catch {} } } catch {} return m; })();
// call-enrich: horario semanal + teléfono verificado + estado, por place_id (lo escribe enrich-calls.mjs).
const callEnrich = (() => { const p = resolve(REPO_ROOT, "targets", `call-enrich-${today()}.json`); try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {}; } catch { return {}; } })();

// n = prioridad ESTABLE (orden de la lista, 1 = más prioritario). No se renumera al filtrar.
const mk = (r, i, extra) => { const id = r.place_id || slug(r.negocio, r.ciudad); const s = sentLog[id]; const ready = pdfReady(r.negocio, r.ciudad); return Object.assign({ n: i + 1, id, negocio: r.negocio, ciudad: r.ciudad, pdf: ready ? pdf(r.negocio, r.ciudad) : null, sent: !!s, sentAt: s ? s.at : null }, extra(r)); };

const calls = read("lote-LLAMADAS").map((r, i) => mk(r, i, (r) => { const e = callEnrich[r.place_id] || {}; return { ch: "call", tel: e.phone || r.telefono, gancho: r.gancho, vertical: r.vertical, reviews: r["reseñas"], nota: r.nota, hours: e.periods || null, status: e.status || null }; }));
const whats = read("lote-WHATSAPP").map((r, i) => mk(r, i, (r) => { const fd = findById.get(r.place_id); const msg = fd && fd.findings ? waText(fd.findings, r.negocio, r.ciudad) : waTextGeneric(r.negocio, r.ciudad); return { ch: "wa", tel: r.telefono, wa: waMe(r.telefono, msg) }; }));
const emails = read("lote-EMAIL").map((r, i) => mk(r, i, (r) => ({ ch: "email", email: r.email, vertical: r.vertical })));
// Instagram: negocios con IG-como-web (sin web real) → los escribe ig-find.mjs.
const instaRaw = (() => { const p = resolve(REPO_ROOT, "targets", `instagram-${today()}.json`); try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : []; } catch { return []; } })();
const insta = instaRaw.map((r, i) => mk(r, i, (b) => ({ ch: "ig", ig: b.ig, handle: b.handle, reviews: b.reviews, vertical: b.vertical, msg: igText(b) })));

const DATA = { calls, whats, emails, insta, date: today() };

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Faro · Centro de operaciones</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0C1210;--surface:#121A16;--surface2:#0F1713;--ink:#ECEAE0;--soft:#9DA79F;--faint:#6C7670;--line:rgba(255,255,255,.09);--brand:#41D49C;--ochre:#E9B65C;--up:#41D49C;--down:#E0795B;}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:14px;background-image:radial-gradient(900px 480px at 12% -8%,rgba(65,212,156,.10),transparent 60%),radial-gradient(800px 500px at 100% 0,rgba(233,182,92,.07),transparent 55%);background-attachment:fixed;min-height:100vh}
.display{font-family:"Fraunces",Georgia,serif}.wrap{max-width:1200px;margin:0 auto;padding:20px 22px 70px}
a{color:inherit;text-decoration:none}
.top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px}
.mark{font-family:"Fraunces",serif;font-weight:600;font-size:23px}.mark i{color:var(--brand);font-style:normal}
.sub{font-size:11px;color:var(--faint);letter-spacing:.14em;text-transform:uppercase}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
@media(max-width:760px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px 18px}
.stat .l{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);font-weight:700}
.stat .v{font-family:"Fraunces",serif;font-size:30px;font-weight:600;margin-top:6px}
.stat .v small{font-size:14px;color:var(--soft);font-family:"Hanken Grotesk"}
.bar{height:6px;border-radius:9px;background:rgba(255,255,255,.08);margin-top:10px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--brand),var(--ochre))}
.tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tabs button{border:1px solid var(--line);background:var(--surface);color:var(--soft);font:inherit;font-weight:700;font-size:14px;padding:9px 16px;border-radius:11px;cursor:pointer;display:flex;gap:8px;align-items:center}
.tabs button.on{background:var(--brand);color:#06120D;border-color:transparent}
.tabs .cnt{font-size:12px;opacity:.8}
.toolbar{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.toolbar input{flex:1;min-width:200px;font:inherit;font-size:14px;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:11px 14px;color:var(--ink);outline:none}
.toolbar input:focus{border-color:var(--brand)}
.filterbtns{display:flex;gap:5px}.filterbtns button{font:inherit;font-size:12px;font-weight:600;border:1px solid var(--line);background:var(--surface);color:var(--soft);padding:7px 11px;border-radius:9px;cursor:pointer}.filterbtns button.on{background:var(--ink);color:var(--bg)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:10px;border-bottom:1px solid var(--line);vertical-align:middle}
tr.done{opacity:.5}
tr.sent td{background:color-mix(in srgb,var(--brand) 7%,transparent)}
.badge-sent{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:12px;color:var(--brand);background:color-mix(in srgb,var(--brand) 14%,transparent);border:1px solid color-mix(in srgb,var(--brand) 30%,transparent);padding:5px 10px;border-radius:8px;white-space:nowrap}
.ob{font-size:11.5px;font-weight:700;white-space:nowrap}.ob-o{color:var(--brand)}.ob-c{color:var(--down)}.ob-x{color:var(--down)}.ob-u{color:var(--faint)}
.neg{font-weight:600}.ciu{color:var(--soft);font-size:12.5px}
.gancho{color:var(--soft);font-size:12.5px;max-width:300px}
.act{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:12.5px;padding:7px 12px;border-radius:9px;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.act-call{background:color-mix(in srgb,var(--brand) 16%,transparent);color:var(--brand);border-color:color-mix(in srgb,var(--brand) 30%,transparent)}
.act-script{background:color-mix(in srgb,var(--ochre) 16%,transparent);color:var(--ochre);border:1px solid color-mix(in srgb,var(--ochre) 32%,transparent)}
.act-wa{background:#1f8f5e;color:#fff}
.act-pdf{background:var(--surface);color:var(--ochre);border-color:color-mix(in srgb,var(--ochre) 35%,transparent)}
.act-ig{background:linear-gradient(45deg,#F58529,#DD2A7B,#8134AF);color:#fff;border:none}
.act-copy{background:var(--surface2);color:var(--ink);border:1px solid var(--line)}
.act:hover{filter:brightness(1.12)}
.rowacts{display:flex;gap:6px;flex-wrap:wrap}
.statussel{font:inherit;font-size:12.5px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 8px}
.chk{width:20px;height:20px;cursor:pointer;accent-color:var(--brand)}
.foot{color:var(--faint);font-size:11px;text-align:center;margin-top:26px}
section.tab{display:none}section.tab.on{display:block}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:6px 6px;overflow-x:auto}
/* modal guión */
#modal{position:fixed;inset:0;z-index:120;background:rgba(4,8,6,.66);display:none;align-items:center;justify-content:center;padding:20px}
#modal.on{display:flex}
#modal .mbox{background:var(--surface);border:1px solid var(--line);border-radius:18px;max-width:660px;width:100%;max-height:86vh;overflow:auto;padding:26px 28px;position:relative;box-shadow:0 30px 80px rgba(0,0,0,.5)}
#modal .mx{position:absolute;top:14px;right:16px;background:none;border:none;color:var(--soft);font-size:20px;cursor:pointer;line-height:1}
#modal .mkick{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ochre);font-weight:700}
#modal .mtitle{font-family:"Fraunces",serif;font-size:22px;font-weight:600;margin:4px 0 16px;padding-right:30px}
#modal .mbd{white-space:pre-wrap;line-height:1.55;font-size:14px;color:var(--ink)}
#modal .mbd b{color:var(--brand);font-weight:700}
/* gate */
#gate{position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:var(--bg)}
#gate .box{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:30px;width:320px;text-align:center}
#gate input{width:100%;box-sizing:border-box;padding:12px 14px;margin:14px 0 10px;border:1px solid var(--line);border-radius:11px;background:var(--surface2);color:var(--ink);font:inherit;font-size:14px}
#gate button{width:100%;padding:12px;border:none;border-radius:11px;background:var(--brand);color:#06120D;font:inherit;font-weight:700;cursor:pointer}
</style></head><body>
<div id="gate"><div class="box"><div class="display" style="font-size:26px;font-weight:600">Faro<span style="color:var(--brand)">.</span> ops</div>
  <input id="gp" type="password" placeholder="contraseña"><button id="gb">Entrar</button><div id="ge" style="color:var(--down);font-size:12px;margin-top:8px;min-height:14px"></div></div></div>
<div id="modal"><div class="mbox"><button class="mx" onclick="closeModal()">✕</button><div class="mkick" id="mkick"></div><div class="mtitle" id="mtitle"></div><div class="mbd" id="mbody"></div></div></div>
<div class="wrap" id="app" style="display:none">
  <div class="top"><div><span class="mark">Faro<i>.</i></span> <span class="sub">Centro de operaciones</span></div><div class="sub" id="dt"></div></div>
  <div class="stats" id="stats"></div>
  <div class="tabs" id="tabs">
    <button data-t="calls" class="on">📞 Llamadas <span class="cnt" id="c-calls"></span></button>
    <button data-t="whats">💬 WhatsApp <span class="cnt" id="c-whats"></span></button>
    <button data-t="emails">✉️ Email <span class="cnt" id="c-emails"></span></button>
    <button data-t="insta">📸 Instagram <span class="cnt" id="c-insta"></span></button>
    <button data-t="segui">🔁 Seguimiento <span class="cnt" id="c-segui"></span></button>
  </div>
  <div class="toolbar"><input id="q" placeholder="Buscar negocio o ciudad…"><div class="filterbtns" id="filt"><button data-f="all" class="on">Todos</button><button data-f="open">🟢 Abiertos ahora</button><button data-f="pend">Pendientes</button><button data-f="done">Hechos</button></div></div>
  <section class="tab on" id="t-calls"><div class="card"><table><thead><tr><th>#</th><th>Negocio</th><th>Teléfono</th><th>Acción</th><th>Estado</th><th>✓</th></tr></thead><tbody id="tb-calls"></tbody></table></div></section>
  <section class="tab" id="t-whats"><div class="card"><table><thead><tr><th>#</th><th>Negocio</th><th>WhatsApp</th><th>Audit</th><th>Estado</th><th>✓</th></tr></thead><tbody id="tb-whats"></tbody></table></div></section>
  <section class="tab" id="t-emails"><div class="card"><table><thead><tr><th>#</th><th>Negocio</th><th>Email</th><th>Audit</th><th>Estado</th></tr></thead><tbody id="tb-emails"></tbody></table></div></section>
  <section class="tab" id="t-insta"><div class="card"><table><thead><tr><th>#</th><th>Negocio</th><th>Instagram</th><th>Acción</th><th>Estado</th><th>✓</th></tr></thead><tbody id="tb-insta"></tbody></table></div></section>
  <section class="tab" id="t-segui"><div class="card"><table><thead><tr><th>Negocio</th><th>Último toque</th><th>Cuándo</th><th>Recontactar</th></tr></thead><tbody id="tb-segui"></tbody></table></div></section>
  <div class="foot" id="ft"></div>
</div>
<script>
var DATA=${JSON.stringify(DATA)};
var PASS=${JSON.stringify(PASSWORD)};
var STK="faro_ops_state";
var ST=(function(){try{return JSON.parse(localStorage.getItem(STK))||{}}catch(e){return {}}})();
function save(){try{localStorage.setItem(STK,JSON.stringify(ST))}catch(e){}}
function status(id){return (ST[id]&&ST[id].s)||"pend"}
function setStatus(id,s){ST[id]=ST[id]||{};ST[id].s=s;if(s==='seguimiento')ST[id].fu=Date.now();save();renderStats();applyFilter()}
var CUR="calls",FILT="all",Q="";
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function tel(t){return (t||"").replace(/\\s/g,"")}
var SEL=['pend','hecho','interesado','seguimiento','descartado'];
var SELL={pend:'Pendiente',hecho:'Hecho',interesado:'⭐ Interesado',seguimiento:'🔁 Seguimiento',descartado:'Descartado'};
var FU_DAYS=21;
function selHtml(id){var s=status(id);return '<select class="statussel" onchange="setStatus(\\''+id+'\\',this.value)">'+SEL.map(function(o){return '<option value="'+o+'"'+(o===s?' selected':'')+'>'+SELL[o]+'</option>'}).join('')+'</select>'}
function isDone(id){var s=status(id);return s==='hecho'||s==='descartado'}
function rdone(r){return r.sent||isDone(r.id)}
function fmtD(iso){try{return new Date(iso).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function estado(r){return r.sent?'<span class="badge-sent">✅ Enviado'+(r.sentAt?' · '+esc(fmtD(r.sentAt)):'')+'</span>':selHtml(r.id)}
function pdfCell(r){return r.pdf?'<a class="act act-pdf" target="_blank" rel="noopener" href="'+esc(r.pdf)+'">📄 PDF</a>':'<span class="act act-pdf" style="opacity:.45;cursor:default">📄 en cola</span>'}
// Abierto ahora (según horario semanal de Google + hora local del navegador). true/false/null(s/d).
function openNow(r){
  if(!r.hours||!r.hours.length) return null;
  var now=new Date(), d=now.getDay(), m=now.getHours()*60+now.getMinutes();
  for(var i=0;i<r.hours.length;i++){var p=r.hours[i];if(!p||!p.open)continue;
    var od=p.open.day, om=p.open.hour*60+(p.open.minute||0), hasC=!!p.close;
    var cd=hasC?p.close.day:od, cm=hasC?(p.close.hour*60+(p.close.minute||0)):1440;
    if(!hasC){ if(d===od&&m>=om) return true; continue; }
    if(od===cd){ if(d===od&&m>=om&&m<cm) return true; }
    else { if(d===od&&m>=om) return true; if(d===cd&&m<cm) return true; }
  }
  return false;
}
function callOpen(r){ if(r.status&&r.status!=='OPERATIONAL') return false; return openNow(r); }
function openBadge(r){
  if(r.status&&r.status!=='OPERATIONAL') return '<span class="ob ob-x">⛔ Cerrado def.</span>';
  var o=openNow(r);
  if(o===true) return '<span class="ob ob-o">🟢 Abierto ahora</span>';
  if(o===false) return '<span class="ob ob-c">🔴 Cerrado ahora</span>';
  return '<span class="ob ob-u">○ horario s/d</span>';
}
var VH={dental:'dentistas',estetica:'centros de estética',fisioterapia:'fisios',pilates:'estudios de pilates',peluqueria:'peluquerías'};
function callScript(r){
  var vh=VH[r.vertical]||(r.vertical||'tu sector');
  var rv=parseInt(r.reviews,10); var nt=parseFloat(String(r.nota||'').replace(',','.'));
  var proof;
  if(rv && rv<30) proof='los que salen por delante tienen muchísimas más reseñas que vosotros ('+rv+' es muy poco para pelear «'+esc(vh)+' '+esc(r.ciudad)+'»), y Google usa eso para ordenar quién sale primero';
  else if(nt && nt<4.3) proof='vuestra nota ('+esc(r.nota)+') está por debajo de la de los que aparecen arriba, y eso frena que Google os suba';
  else proof='no estáis saliendo en los primeros puestos cuando alguien busca «'+esc(vh)+' '+esc(r.ciudad)+'», que es justo donde se reparten las llamadas';
  return '<b>EL ÁNGULO (lo que de verdad les duele — transmite ESTO):</b>\\nNo les hables de "una foto" ni "una reseña" (eso lo arreglan ellos solos y suena a poco). El mensaje es: la COMPETENCIA les está ganando en visibilidad y se está llevando a sus clientes — y si no lo trabajan, cada mes pierden más.\\n\\n'+
    '<b>1) Apertura (natural, NO telemarketing):</b>\\n"Hola, buenas, ¿hablo con '+esc(r.negocio)+'? Soy Jordi, soy de aquí. ¿Tienes 30 segundos? No te vendo nada raro."\\n\\n'+
    '<b>2) El gancho (que duela):</b>\\n"He estado mirando los/las '+esc(vh)+' de '+esc(r.ciudad)+' en Google y, siéndote sincero, os están comiendo terreno. Cuando alguien busca por la zona, vuestra competencia sale por delante y se lleva esos clientes — '+proof+'."\\n\\n'+
    '<b>3) La consecuencia (urgencia real):</b>\\n"Y esto no se queda igual: cada mes que no se trabaja el posicionamiento, los de al lado os sacan más distancia. Posicionarse cuesta meses; perder el sitio, semanas."\\n\\n'+
    '<b>4) Cómo lo vendes:</b>\\n"Nosotros os ponemos por delante y os mantenemos ahí, trabajándolo cada mes. Os preparé un análisis de 1 página, gratis, con vuestros números y los de la competencia al lado."\\n\\n'+
    '<b>5) El cierre (consigue el SÍ, no cierres en la llamada):</b>\\n"¿Te lo paso por WhatsApp o email y lo ves cuando puedas? Y si te encaja, te llamo 5 min y te cuento cómo lo haríamos."\\n\\n'+
    '<b>Si pone pegas:</b>\\n"Sin compromiso de verdad: si no te sirve, lo tiras y ya. Pero lo que vi te interesa."';
}
function openModal(kick,title,html){document.getElementById('mkick').textContent=kick;document.getElementById('mtitle').textContent=title;document.getElementById('mbody').innerHTML=html;document.getElementById('modal').classList.add('on')}
function closeModal(){document.getElementById('modal').classList.remove('on')}
function showScript(id){var r=DATA.calls.find(function(x){return x.id===id});if(r)openModal('Guión de llamada','¿Qué decirle a '+r.negocio+'?',callScript(r))}
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal()});
function rowMatch(r){var t=(r.negocio+' '+r.ciudad).toLowerCase();if(Q&&t.indexOf(Q)<0)return false;if(FILT==='open'&&callOpen(r)===false)return false;if(FILT==='done'&&!rdone(r))return false;if(FILT==='pend'&&rdone(r))return false;return true}
function renderCalls(){document.getElementById('tb-calls').innerHTML=DATA.calls.filter(rowMatch).map(function(r){return '<tr class="'+(rdone(r)?'done':'')+(r.sent?' sent':'')+'"><td>'+r.n+'</td><td><div class="neg">'+esc(r.negocio)+'</div><div class="ciu">'+esc(r.ciudad)+' · '+openBadge(r)+'</div></td><td>'+esc(r.tel||'')+'</td><td><div class="rowacts"><a class="act act-call" href="tel:'+esc(tel(r.tel))+'">📞 Llamar</a><button class="act act-script" onclick="showScript(\\''+r.id+'\\')">🗒️ Ver guión</button></div></td><td>'+estado(r)+'</td><td><input type="checkbox" class="chk" '+(rdone(r)?'checked':'')+' onchange="setStatus(\\''+r.id+'\\',this.checked?\\'hecho\\':\\'pend\\')"></td></tr>'}).join('')}
function renderWhats(){document.getElementById('tb-whats').innerHTML=DATA.whats.filter(rowMatch).map(function(r){return '<tr class="'+(rdone(r)?'done':'')+(r.sent?' sent':'')+'"><td>'+r.n+'</td><td><div class="neg">'+esc(r.negocio)+'</div><div class="ciu">'+esc(r.ciudad)+'</div></td><td><a class="act act-wa" target="_blank" rel="noopener" href="'+esc(r.wa)+'">💬 Abrir WhatsApp</a></td><td>'+pdfCell(r)+'</td><td>'+estado(r)+'</td><td><input type="checkbox" class="chk" '+(rdone(r)?'checked':'')+' onchange="setStatus(\\''+r.id+'\\',this.checked?\\'hecho\\':\\'pend\\')"></td></tr>'}).join('')}
function renderEmails(){document.getElementById('tb-emails').innerHTML=DATA.emails.filter(rowMatch).map(function(r){return '<tr class="'+(rdone(r)?'done':'')+(r.sent?' sent':'')+'"><td>'+r.n+'</td><td><div class="neg">'+esc(r.negocio)+'</div><div class="ciu">'+esc(r.ciudad)+'</div></td><td>'+esc(r.email||'')+'</td><td>'+pdfCell(r)+'</td><td>'+estado(r)+'</td></tr>'}).join('')}
function renderInsta(){document.getElementById('tb-insta').innerHTML=DATA.insta.filter(rowMatch).map(function(r){return '<tr class="'+(rdone(r)?'done':'')+'"><td>'+r.n+'</td><td><div class="neg">'+esc(r.negocio)+'</div><div class="ciu">'+esc(r.ciudad)+' · '+esc(r.reviews)+'★</div></td><td><b>'+esc(r.handle)+'</b></td><td><div class="rowacts"><a class="act act-ig" target="_blank" rel="noopener" href="https://instagram.com/'+esc(r.ig)+'">📸 Abrir IG</a><button class="act act-copy" onclick="copyMsg(this,\\''+r.id+'\\')">📋 Copiar mensaje</button><button class="act act-script" onclick="showIg(\\''+r.id+'\\')">👁️ Ver</button></div></td><td>'+selHtml(r.id)+'</td><td><input type="checkbox" class="chk" '+(rdone(r)?'checked':'')+' onchange="setStatus(\\''+r.id+'\\',this.checked?\\'hecho\\':\\'pend\\')"></td></tr>'}).join('')}
function copyMsg(btn,id){var r=DATA.insta.find(function(x){return x.id===id});if(!r)return;var ok=function(){var t=btn.innerHTML;btn.innerHTML='✓ Copiado';setTimeout(function(){btn.innerHTML=t},1600)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(r.msg).then(ok).catch(function(){showIg(id)})}else{showIg(id)}}
function showIg(id){var r=DATA.insta.find(function(x){return x.id===id});if(r)openModal('Mensaje para '+r.handle,r.negocio+' · '+r.ciudad,esc(r.msg).replace(/\\n/g,'<br>'))}
function fuInfo(id){var st=ST[id];if(!st||!st.fu)return null;var due=st.fu+FU_DAYS*864e5;return {fu:st.fu,due:due,days:Math.ceil((due-Date.now())/864e5)}}
function chLabel(ch){return {call:'📞 Llamada',wa:'💬 WhatsApp',email:'✉️ Email',ig:'📸 Instagram'}[ch]||ch}
function recontactAction(r){if(r.ch==='call')return '<a class="act act-call" href="tel:'+esc(tel(r.tel))+'">📞 Llamar</a>';if(r.ch==='wa')return '<a class="act act-wa" target="_blank" rel="noopener" href="'+esc(r.wa)+'">💬 WhatsApp</a>';if(r.ch==='email')return '<a class="act act-pdf" href="mailto:'+esc(r.email)+'">✉️ Email</a>';if(r.ch==='ig')return '<a class="act act-ig" target="_blank" rel="noopener" href="https://instagram.com/'+esc(r.ig)+'">📸 Abrir IG</a>';return ''}
function renderSegui(){
  var all=DATA.calls.concat(DATA.whats,DATA.emails,DATA.insta).filter(function(r){return status(r.id)==='seguimiento'});
  all.forEach(function(r){r._f=fuInfo(r.id)});
  all.sort(function(a,b){return (a._f?a._f.due:9e15)-(b._f?b._f.due:9e15)});
  document.getElementById('c-segui').textContent=all.length;
  var rows=all.map(function(r){var f=r._f;var badge=!f?'<span class="ob ob-u">s/fecha</span>':(f.days<=0?'<span class="ob ob-c">🔴 Toca seguir ya</span>':'<span class="ob ob-o">en '+f.days+' día'+(f.days===1?'':'s')+'</span>');return '<tr class="'+(f&&f.days<=0?'sent':'')+'"><td><div class="neg">'+esc(r.negocio)+'</div><div class="ciu">'+esc(r.ciudad)+' · '+chLabel(r.ch)+'</div></td><td>'+(f?esc(fmtD(f.fu)):'-')+'</td><td>'+badge+'</td><td><div class="rowacts">'+recontactAction(r)+'<button class="act act-copy" onclick="setStatus(\\''+r.id+'\\',\\'seguimiento\\')">🔁 Toque hecho hoy</button><button class="act act-copy" onclick="setStatus(\\''+r.id+'\\',\\'hecho\\')">✓ Cerrar</button></div></td></tr>'}).join('');
  document.getElementById('tb-segui').innerHTML=rows||'<tr><td colspan="4" style="padding:24px;color:var(--faint)">Aún no hay seguimientos. Marca un negocio como «🔁 Seguimiento» en el desplegable de Estado de cualquier pestaña, y aparecerá aquí con la fecha para volver a contactar (~'+FU_DAYS+' días).</td></tr>';
}
function applyFilter(){renderCalls();renderWhats();renderEmails();renderInsta();renderSegui()}
function renderStats(){
  var groups=[['calls','Llamadas'],['whats','WhatsApp'],['emails','Email'],['insta','Instagram']];var tot=0,don=0;
  document.getElementById('stats').innerHTML=groups.map(function(g){var arr=DATA[g[0]];var d=arr.filter(rdone).length;tot+=arr.length;don+=d;var pct=arr.length?Math.round(100*d/arr.length):0;return '<div class="stat"><div class="l">'+g[1]+'</div><div class="v">'+d+'<small> / '+arr.length+'</small></div><div class="bar"><i style="width:'+pct+'%"></i></div></div>'}).join('')+
    '<div class="stat"><div class="l">Total contactado</div><div class="v">'+don+'<small> / '+tot+'</small></div><div class="bar"><i style="width:'+(tot?Math.round(100*don/tot):0)+'%"></i></div></div>';
  document.getElementById('c-calls').textContent=DATA.calls.length;document.getElementById('c-whats').textContent=DATA.whats.length;document.getElementById('c-emails').textContent=DATA.emails.length;document.getElementById('c-insta').textContent=DATA.insta.length;
}
document.getElementById('tabs').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;CUR=b.dataset.t;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});['calls','whats','emails','insta','segui'].forEach(function(t){document.getElementById('t-'+t).classList.toggle('on',t===CUR)})});
document.getElementById('q').addEventListener('input',function(){Q=this.value.toLowerCase().trim();applyFilter()});
document.getElementById('filt').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;FILT=b.dataset.f;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});applyFilter()});
function boot(){document.getElementById('dt').textContent='Lote '+DATA.date;document.getElementById('ft').textContent='Estado guardado en este navegador · '+(DATA.calls.length+DATA.whats.length+DATA.emails.length+DATA.insta.length)+' acciones · ordenado por prioridad · Faro';renderStats();applyFilter()}
function enter(){document.getElementById('gate').style.display='none';document.getElementById('app').style.display='block';boot()}
document.getElementById('gb').addEventListener('click',function(){if(document.getElementById('gp').value===PASS){try{localStorage.setItem('faro_ops_auth','1')}catch(e){}enter()}else{document.getElementById('ge').textContent='Contraseña incorrecta'}});
document.getElementById('gp').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('gb').click()});
try{if(localStorage.getItem('faro_ops_auth')==='1')enter()}catch(e){}
</script></body></html>`;

const dir = resolve(REPO_ROOT, "apps", "ops");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "index.html"), html, "utf8");
console.log(`✅ Centro de operaciones generado: apps/ops/index.html`);
console.log(`   Llamadas: ${calls.length} · WhatsApp: ${whats.length} · Email: ${emails.length}`);
console.log(`   Contraseña: ${PASSWORD}`);
