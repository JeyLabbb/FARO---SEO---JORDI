// _pdf-shot.mjs — renderiza un PDF a PNG: lo incrusta en un HTML con pdf.js y lo
// sirve por http://localhost (los Web Workers no funcionan por file://), luego
// Chrome headless hace la captura. NECESITA RED → dangerouslyDisableSandbox.
//   node src/_pdf-shot.mjs <ruta.pdf> <salida.png>
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { execFile } from "node:child_process";

const pdfPath = process.argv[2];
const outPng = process.argv[3] || "C:/Users/jordi/AppData/Local/Temp/pdfshot.png";
const TEMP = "C:/Users/jordi/AppData/Local/Temp";
const V = "3.11.174";
const cdn = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}`;
const PORT = 8799;

async function dl(name) {
  const p = `${TEMP}/${name}`;
  if (!existsSync(p)) { const r = await fetch(`${cdn}/${name}`); if (!r.ok) throw new Error(`${name} HTTP ${r.status}`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); }
  return name;
}
await dl("pdf.min.js");
await dl("pdf.worker.min.js");
const b64 = readFileSync(pdfPath).toString("base64");

writeFileSync(`${TEMP}/jorgeview.html`, `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}canvas{display:block;margin:0 auto 10px}</style>
<script src="/pdf.min.js"></script><script src="/pdf.worker.min.js"></script></head><body><div id="c"></div>
<script>
function toArr(b){const r=atob(b),a=new Uint8Array(r.length);for(let i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return a;}
window.Worker=undefined;
pdfjsLib.GlobalWorkerOptions.workerSrc="/pdf.worker.min.js";
pdfjsLib.getDocument({data:toArr("${b64}")}).promise.then(async (pdf)=>{
  for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const vp=page.getViewport({scale:2});const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;document.getElementById("c").appendChild(cv);await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;}
  document.title="DONE"+pdf.numPages;
}).catch(e=>{document.title="ERR:"+(e&&e.message||e);});
</script></body></html>`, "utf8");

const types = { ".html": "text/html", ".js": "application/javascript", ".png": "image/png" };
const server = createServer((req, res) => {
  const name = decodeURIComponent((req.url || "/").split("?")[0]);
  const p = resolve(TEMP, name === "/" ? "jorgeview.html" : name.replace(/^\//, ""));
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
});
server.listen(PORT, () => {
  const BR = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  execFile(BR, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=30000", `--user-data-dir=${TEMP}/.pdfshotX`, "--window-size=1300,9000", `--screenshot=${outPng}`, `http://localhost:${PORT}/jorgeview.html`], { timeout: 90000 }, (err) => {
    server.close();
    console.log(err ? "chrome err: " + err.message : "OK → " + outPng);
  });
});
