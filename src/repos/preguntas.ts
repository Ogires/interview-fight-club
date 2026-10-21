// src/repos/preguntas.ts — banco curado en D1
import type { Concepto } from "../dominio/texto";

export interface Pregunta {
  id: string;
  texto: string;
  rubrica: Concepto[];
  esperado: string;
}

export async function sortearPreguntas(db: D1Database, stack: string, nivel: string, n: number): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT id FROM preguntas WHERE stack = ? AND nivel = ? AND activa = 1 ORDER BY RANDOM() LIMIT ?")
    .bind(stack, nivel, n)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function leerPregunta(db: D1Database, id: string): Promise<Pregunta | null> {
  const f = await db
    .prepare("SELECT id, texto, rubrica, esperado FROM preguntas WHERE id = ?")
    .bind(id)
    .first<{ id: string; texto: string; rubrica: string; esperado: string }>();
  return f ? { ...f, rubrica: JSON.parse(f.rubrica) } : null;
}
