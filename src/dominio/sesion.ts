export const TOTAL_PREGUNTAS = 5;
export const RESERVA_MS = 30_000; // si el Worker muere a mitad de turno, la reserva caduca

export type EstadoSesion = "en_curso" | "terminada";
export type Rechazo = "terminada" | "fuera_de_orden" | "reservada";

export interface Turno {
  estado: EstadoSesion;
  nPregunta: number; // respondidas
  reservaMs: number | null;
}

// Validación previa con mensajes claros; el repo repite la condición en el UPDATE
// (bloqueo optimista), que es lo que de verdad evita gastar tokens dos veces
export function puedeResponder(s: Turno, n: number, ahoraMs: number): Rechazo | null {
  if (s.estado === "terminada") return "terminada";
  if (n !== s.nPregunta + 1) return "fuera_de_orden";
  if (s.reservaMs !== null && ahoraMs - s.reservaMs < RESERVA_MS) return "reservada";
  return null;
}
