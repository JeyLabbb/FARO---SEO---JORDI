// panel-backup.mjs — copia de seguridad GRATIS de la BD del panel.
// Exporta todas las tablas públicas a un JSON con fecha, FUERA de OneDrive
// (~/.faro/backups/). Pensado para correr junto al robot semanal.
//
//   node src/panel-backup.mjs        (necesita red → dangerouslyDisableSandbox)
//
// Nota: cubre los DATOS (clients, snapshots, reseñas, etc.). Las CUENTAS de
// login (auth.users) las respalda Supabase por su lado.

import { homedir } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { rest } from "./lib/panel.mjs";

const TABLES = ["clients", "client_users", "snapshots", "rankings", "reviews", "competitors", "activity", "plan_items"];

const tables = {};
let total = 0;
for (const t of TABLES) {
  const rows = await rest("GET", `${t}?select=*`);
  tables[t] = rows;
  total += rows.length;
  console.log(`  ${t.padEnd(12)} ${rows.length}`);
}

const dir = resolve(homedir(), ".faro", "backups");
mkdirSync(dir, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const out = resolve(dir, `panel-${date}.json`);
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), tables }, null, 2), "utf8");

console.log(`\n✅ Backup: ${total} filas → ${out}`);
