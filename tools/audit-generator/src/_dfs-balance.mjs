// _dfs-balance.mjs — consulta el saldo REAL de DataForSEO (v3/appendix/user_data).
// NECESITA RED → dangerouslyDisableSandbox.
import "./config.mjs";

const LOGIN = process.env.DATAFORSEO_LOGIN || "";
const PASSWORD = process.env.DATAFORSEO_PASSWORD || "";
if (!LOGIN || !PASSWORD) { console.error("✗ Sin DATAFORSEO_LOGIN/PASSWORD en .env"); process.exit(1); }
const auth = "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: auth } });
const data = await res.json().catch(() => ({}));
const r = data.tasks?.[0]?.result?.[0];
if (!r) { console.error("✗ Respuesta inesperada:", JSON.stringify(data).slice(0, 300)); process.exit(1); }
const m = r.money || {};
console.log(`Cuenta DataForSEO: ${r.login || LOGIN}`);
console.log(`Saldo: ${m.balance} ${m.currency || "USD"}`);
console.log(`Gasto total histórico: ${m.total ?? "?"}  ·  Límite diario: ${m.limits?.day ?? "?"}`);
