// src/repos/veredictos.ts — veredicto inmutable compartible en /r/{publicoId}
export interface Veredicto {
  publicoId: string;
  alias: string;
  stack: string;
  nivel: string;
  villano: string;
  media: number;
  rango: string;
  fraseFinal: string;
  desglose: { pregunta: string; nota: number; comentario: string; esperado: string }[];
  creadoMs?: number;
}

// Atómico e idempotente (batch = transacción): se reclama publico_id en la sesión y el
// INSERT solo ocurre si el reclamo es nuestro. Inmutable: nunca hay UPDATE (A08)
export async function guardarVeredicto(db: D1Database, sesionId: string, v: Veredicto): Promise<string | null> {
  await db.batch([
    db
      .prepare("UPDATE sesiones SET publico_id = ? WHERE id = ? AND estado = 'terminada' AND publico_id IS NULL")
      .bind(v.publicoId, sesionId),
    db
      .prepare(
        `INSERT INTO veredictos (publico_id, alias, stack, nivel, villano, media, rango, frase_final, desglose, creado_ms)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sesiones WHERE id = ? AND publico_id = ?)
         ON CONFLICT (publico_id) DO NOTHING`
      )
      .bind(v.publicoId, v.alias, v.stack, v.nivel, v.villano, v.media, v.rango, v.fraseFinal, JSON.stringify(v.desglose), Date.now(), sesionId, v.publicoId),
  ]);
  const f = await db.prepare("SELECT publico_id FROM sesiones WHERE id = ?").bind(sesionId).first<{ publico_id: string | null }>();
  return f?.publico_id ?? null;
}

export async function leerVeredicto(db: D1Database, publicoId: string): Promise<Veredicto | null> {
  const f = await db.prepare("SELECT * FROM veredictos WHERE publico_id = ?").bind(publicoId).first<Record<string, any>>();
  if (!f) return null;
  return {
    publicoId: f.publico_id, alias: f.alias, stack: f.stack, nivel: f.nivel, villano: f.villano,
    media: f.media, rango: f.rango, fraseFinal: f.frase_final, desglose: JSON.parse(f.desglose), creadoMs: f.creado_ms,
  };
}
