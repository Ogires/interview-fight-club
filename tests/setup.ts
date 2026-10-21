// tests/setup.ts — migraciones + banco de prueba (idempotente: el setup corre por fichero)
import { applyD1Migrations, env } from "cloudflare:test";
import banco from "./fixtures/preguntas.json";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
await env.DB.batch(
  banco.map((p) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO preguntas (id, stack, nivel, texto, rubrica, esperado) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(p.id, p.stack, p.nivel, p.texto, JSON.stringify(p.rubrica), p.esperado)
  )
);
