// _pdf-to-html.mjs — incrusta un PDF (base64) en un HTML que lo pinta a <canvas>
// con pdf.js. Descarga pdf.js a LOCAL (Node sí tiene red) y lo referencia por
// file:// para que Chrome headless no dependa de la red.
//   node src/_pdf-to-html.mjs <ruta.pdf> <salida.html> [libDir]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const pdfPath = process.argv[2];
const out = process.argv[3];
const libDir = process.argv[4] || "C:/Users/jordi/AppData/Local/Temp";
const V = "3.11.174";
const base = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}`;

async function dl(name) {
  const p = `${libDir}/${name}`;
  if (!existsSync(p)) {
    const r = await fetch(`${base}/${name}`);
    if (!r.ok) throw new Error(`fetch ${name}: HTTP ${r.status}`);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
    console.log("descargado", name);
  }
  return p;
}
const fileurl = (p) => "file:///" + p.replace(/\\/g, "/");

const lib = await dl("pdf.min.js");
const wk = await dl("pdf.worker.min.js");
const b64 = readFileSync(pdfPath).toString("base64");
const wkB64 = readFileSync(wk).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff} canvas{display:block;margin:0 auto 10px}</style>
<script src="${fileurl(lib)}"></script></head><body><div id="c"></div>
<script>
function toArr(b){const r=atob(b),a=new Uint8Array(r.length);for(let i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return a;}
window.onerror=function(m){document.title="ONERR:"+m;};
document.title="START";
const arr=toArr("${b64}");
const wkBlob=new Blob([toArr("${wkB64}")],{type:"application/javascript"});
pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(wkBlob);
document.title="WSET";
pdfjsLib.getDocument({data:arr}).promise.then(async (pdf)=>{
  document.title="PAGES="+pdf.numPages;
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const vp=page.getViewport({scale:2});
    const cv=document.createElement("canvas"); cv.width=vp.width; cv.height=vp.height;
    document.getElementById("c").appendChild(cv);
    await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
  }
  document.title="DONE"+pdf.numPages;
}).catch(e=>{document.title="ERR:"+(e&&e.message||e);});
</script></body></html>`;
writeFileSync(out, html, "utf8");
console.log("written", out);
