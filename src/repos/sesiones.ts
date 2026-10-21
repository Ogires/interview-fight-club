// src/repos/sesiones.ts — sesión autoritativa en D1
import { RESERVA_MS, TOTAL_PREGUNTAS, type EstadoSesion } from "../dominio/sesion";

export interface Sesion {
  id: string;
  alias: string;
  stack: string;
  nivel: string;
  villano: string;
  preguntas: string[];
  nPregunta: number;
  notas: number[];
  comentarios: string[];
  estado: EstadoSesion;
  reservaMs: number | null;
  publicoId: string | null;
}

export async function crearSesion(
  db: D1Database,
  s: { id: string; alias: string; stack: string; nivel: string; villano: string; preguntas: string[] }
): Promise<void> {
  await db
    .prepare("INSERT INTO sesiones (id, alias, stack, nivel, villano, preguntas, creada_ms) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(s.id, s.alias, s.stack, s.nivel, s.villano, JSON.stringify(s.preguntas), Date.now())
    .run();
}

export async function leerSesion(db: D1Database, id: string): Promise<Sesion | null> {
  const f = await db.prepare("SELECT * FROM sesiones WHERE id = ?").bind(id).first<Record<string, any>>();
  if (!f) return null;
  return {
    id: f.id, alias: f.alias, stack: f.stack, nivel: f.nivel, villano: f.villano,
    preguntas: JSON.parse(f.preguntas), nPregunta: f.n_pregunta,
    notas: JSON.parse(f.notas), comentarios: JSON.parse(f.comentarios),
    estado: f.estado, reservaMs: f.reserva_ms, publicoId: f.publico_id,
  };
}

// Bloqueo optimista ANTES de gastar tokens: dos peticiones del mismo turno, una gana
export async function reservarTurno(db: D1Database, id: string, n: number, ahoraMs: number): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE sesiones SET reserva_ms = ?
       WHERE id = ? AND estado = 'en_curso' AND n_pregunta = ? AND (reserva_ms IS NULL OR reserva_ms <= ?)`
    )
    .bind(ahoraMs, id, n - 1, ahoraMs - RESERVA_MS)
    .run();
  return r.meta.changes === 1;
}

export async function completarTurno(db: D1Database, id: string, n: number, nota: number, comentario: string): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE sesiones SET
         notas = json_insert(notas, '$[#]', ?),
         comentarios = json_insert(comentarios, '$[#]', ?),
         n_pregunta = n_pregunta + 1,
         reserva_ms = NULL,
         estado = CASE WHEN n_pregunta + 1 >= ${TOTAL_PREGUNTAS} THEN 'terminada' ELSE estado END
       WHERE id = ? AND n_pregunta = ?`
    )
    .bind(nota, comentario, id, n - 1)
    .run();
  return r.meta.changes === 1;
}

export async function liberarTurno(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE sesiones SET reserva_ms = NULL WHERE id = ?").bind(id).run();
}
