// _verify.mjs — comprueba: (1) cero duplicados entre las 3 listas, (2) que en
// WhatsApp NO haya ningún fijo (9xx), (3) conteos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { today } from "./lib/slug.mjs";
function parseCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } } o.push(c); return o; }
function rows(name) { const L = readFileSync(resolve(REPO_ROOT, "targets", `${name}-${today()}.csv`), "utf8").split(/\r?\n/).filter(Boolean); const h = parseCsv(L[0]); const ix = (n) => h.indexOf(n); return L.slice(1).map(parseCsv).map((c) => ({ pid: c[ix("place_id")], tel: c[ix("telefono")], neg: c[ix("negocio")] })); }
const calls = rows("lote-LLAMADAS"), wa = rows("lote-WHATSAPP"), em = rows("lote-EMAIL");
const setC = new Set(calls.map((x) => x.pid)), setW = new Set(wa.map((x) => x.pid)), setE = new Set(em.map((x) => x.pid));
const inter = (a, b) => [...a].filter((x) => b.has(x));
console.log(`Conteo → Llamadas ${calls.length} · WhatsApp ${wa.length} · Email ${em.length}`);
console.log(`Duplicados → Llamadas∩WhatsApp: ${inter(setC, setW).length} · Llamadas∩Email: ${inter(setC, setE).length} · WhatsApp∩Email: ${inter(setW, setE).length}`);
const isMobile = (t) => /^[67]/.test((t || "").replace(/[^\d]/g, "").replace(/^(?:00)?34/, ""));
const badWa = wa.filter((x) => !isMobile(x.tel));
console.log(`WhatsApp con número NO-móvil (fijo): ${badWa.length}`);
badWa.slice(0, 8).forEach((x) => console.log(`   ⚠ ${x.tel}  ${x.neg}`));
