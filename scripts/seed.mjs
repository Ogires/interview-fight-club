// scripts/seed.mjs — carga el banco público en D1 (upsert por id: nunca borra preguntas
// ya sorteadas en sesiones; para retirar una, ponerle "activa": false).
// Uso: npm run seed -- [--local|--remote] [--yes] [ruta=data/preguntas.json]
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { validarBanco } from "./validar-banco.mjs";

const args = process.argv.slice(2);
const remoto = args.includes("--remote");
const flag = remoto ? "--remote" : "--local";
const ruta = args.find((a) => !a.startsWith("--")) ?? "data/preguntas.json";
const SQL = ".wrangler/seed-preguntas.sql";

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

const banco = JSON.parse(readFileSync(ruta, "utf8"));
const errores = validarBanco(banco);
if (errores.length) {
  console.error(`❌ ${ruta} tiene ${errores.length} errores:\n  ${errores.join("\n  ")}`);
  process.exit(1);
}

if (remoto && !args.includes("--yes")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question("⚠️  Vas a escribir en la D1 REMOTA (producción). Escribe «si» para continuar: ");
  rl.close();
  if (r.trim().toLowerCase() !== "si") {
    console.log("Cancelado.");
    process.exit(1);
  }
}

const filas = banco.map((p) => {
  const activa = p.activa === false || p.activa === 0 ? 0 : 1;
  return (
    `INSERT INTO preguntas (id, stack, nivel, texto, rubrica, esperado, activa) VALUES (` +
    `${sql(p.id)}, ${sql(p.stack)}, ${sql(p.nivel)}, ${sql(p.texto)}, ${sql(JSON.stringify(p.rubrica))}, ` +
    `${sql(p.esperado)}, ${activa}) ON CONFLICT(id) DO UPDATE SET texto=excluded.texto, ` +
    `rubrica=excluded.rubrica, esperado=excluded.esperado, activa=excluded.activa;`
  );
});
mkdirSync(".wrangler", { recursive: true });
writeFileSync(SQL, filas.join("\n") + "\n", "utf8");

execSync(`npx wrangler d1 execute interview-fight-club ${flag} --file ${SQL} --yes`, {
  shell: true,
  stdio: ["ignore", "inherit", "inherit"],
});
const activas = filas.length - banco.filter((p) => p.activa === false || p.activa === 0).length;
console.log(`✅ ${filas.length} preguntas cargadas (${activas} activas) en la D1 ${remoto ? "REMOTA" : "local"}`);
