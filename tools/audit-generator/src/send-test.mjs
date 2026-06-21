// send-test.mjs — prueba el envío Gmail SMTP con PDF adjunto (a tu propia cuenta).
//   node src/send-test.mjs   (NECESITA RED → dangerouslyDisableSandbox)
import "./config.mjs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./config.mjs";
import { sendMail, gmailAccounts } from "./lib/gmail-smtp.mjs";

const accs = gmailAccounts();
if (!accs.length) { console.error("No hay GMAIL_ACCOUNTS en ~/.faro/.env"); process.exit(1); }
const sender = accs.find((a) => a.user.includes("yourbusinesstry")) || accs[0];
const to = "borrutjordi548@gmail.com";
const pdf = resolve(REPO_ROOT, "apps", "web", "audits", process.argv[2] || "gymdance-getafe.pdf");

console.log(`Enviando de ${sender.user} → ${to} (con PDF)…`);
await sendMail({
  user: sender.user, pass: sender.pass, fromName: "Jordi de Faro",
  to,
  subject: "Prueba Faro ✅ — sistema de envío",
  text: "Hola,\n\nEsto es una prueba del sistema de envío de Faro. Si te llega este correo CON el PDF adjunto, todo funciona y ya podemos enviar a los negocios.\n\nJordi — Faro",
  attachments: [{ path: pdf, filename: "analisis-faro.pdf" }],
});
console.log(`✅ Enviado. Revisa la bandeja de ${to} (mira también Spam por si acaso).`);
