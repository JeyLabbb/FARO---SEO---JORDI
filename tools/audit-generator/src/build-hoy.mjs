// build-hoy.mjs — arma el LOTE DEL DÍA (WhatsApp + Email) con datos completos.
// Las listas lote-WHATSAPP / lote-EMAIL solo tienen place_id; este script las
// cruza con negocios-espana-FECHA.csv (que tiene web + vertical) para que
// audit-batch pueda generar SU análisis. Prioriza WhatsApp, luego Email.
//   node src/build-hoy.mjs [--wa 25] [--em 25]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";

function parseCsv(line){const o=[];let c="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch==='"'){if(line[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}else{if(ch===","){o.push(c);c="";}else if(ch==='"')q=true;else c+=ch;}}o.push(c);return o;}
const esc=(v)=>{const s=v==null?"":String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
function rows(file){const L=readFileSync(file,"utf8").split(/\r?\n/).filter(Boolean);const h=parseCsv(L[0]);const ix=(n)=>h.indexOf(n);return {ix,data:L.slice(1).map(parseCsv)};}

const args=process.argv.slice(2);
const numAfter=(f,d)=>{const i=args.indexOf(f);return i>=0?Number(args[i+1]):d;};
const WA=numAfter("--wa",25), EM=numAfter("--em",25);

const esp=rows(resolve(REPO_ROOT,"targets",`negocios-espana-${today()}.csv`));
const byId=new Map();
for(const c of esp.data){const id=c[esp.ix("place_id")];if(id)byId.set(id,{ciudad:c[esp.ix("ciudad")],vertical:c[esp.ix("vertical")],negocio:c[esp.ix("negocio")],web:c[esp.ix("web")],place_id:id});}

const wa=rows(resolve(REPO_ROOT,"targets",`lote-WHATSAPP-${today()}.csv`));
const em=rows(resolve(REPO_ROOT,"targets",`lote-EMAIL-${today()}.csv`));

// Email válido (mismo criterio que send-emails): fuera placeholders y plataformas de reservas.
const PH_DOM=new Set(["email.com","example.com","example.org","example.net","domain.com","dominio.com","tudominio.com","yourdomain.com","test.com","correo.com","booksy.com","treatwell.com","treatwell.es","doctoralia.com","doctoralia.es","topdoctors.es"]);
const PH_LOC=new Set(["tu","tucorreo","tusdatos","tuemail","tunombre","your","youremail","yourname","ejemplo","example","nombre","correo","emailaddress","abc","xxx","test","asdf","aaa"]);
function emailOk(raw){let e;try{e=decodeURIComponent(String(raw||""));}catch{e=String(raw||"");}e=e.replace(/\s+/g,"").toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e))return false;const[l,d]=e.split("@");return !PH_DOM.has(d)&&!PH_LOC.has(l);}
// Negocios ya contactados (sent-log.json) → se saltan, así la cola avanza sola cada día.
const sentLog=(()=>{try{const p=resolve(REPO_ROOT,"targets","sent-log.json");return existsSync(p)?JSON.parse(readFileSync(p,"utf8")):{};}catch{return {};}})();
const sentSet=new Set(Object.keys(sentLog));
const sentEmails=new Set(Object.values(sentLog).map(v=>(v.to||"").toLowerCase()).filter(Boolean));
const out=[]; const seen=new Set(); const seenEmails=new Set(sentEmails);
function take(src,channel,extra,limit){let n=0;for(const c of src.data){if(n>=limit)break;const id=c[src.ix("place_id")];const base=byId.get(id);if(!base||!base.web||seen.has(id)||sentSet.has(id))continue;const row={...base,channel,...extra(c)};if(channel==="email"){const em=(row.email||"").toLowerCase().replace(/\s+/g,"");if(!em||seenEmails.has(em))continue;seenEmails.add(em);}seen.add(id);out.push(row);n++;}}
take(wa,"whatsapp",(c)=>({contact:c[wa.ix("telefono")]||"",wa_link:c[wa.ix("wa_link")]||"",email:""}),WA);
{const emValid={ix:em.ix,data:em.data.filter((c)=>emailOk(c[em.ix("email")]))};take(emValid,"email",(c)=>({contact:c[em.ix("email")]||"",wa_link:"",email:c[em.ix("email")]||""}),EM);}

const cols=["ciudad","vertical","negocio","web","place_id","channel","contact","wa_link","email"];
const csv=[cols.join(",")].concat(out.map(r=>cols.map(k=>esc(r[k])).join(","))).join("\n");
const dst=resolve(REPO_ROOT,"targets",`lote-HOY-${today()}.csv`);
writeFileSync(dst,csv,"utf8");
const nWa=out.filter(r=>r.channel==="whatsapp").length, nEm=out.filter(r=>r.channel==="email").length;
console.log(`Lote HOY: ${out.length} negocios  (WhatsApp ${nWa} + Email ${nEm})`);
console.log(`→ ${dst}`);
