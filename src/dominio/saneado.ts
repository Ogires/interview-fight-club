export const MAX_RESPUESTA = 600;

// La respuesta va al prompt como DATO: se quitan las piezas con las que podría
// falsificar la marca de nota o cerrar el delimitador (LLM01, defensa en profundidad)
export function sanearRespuesta(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  const limpio = entrada
    .normalize("NFC")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/[⟦⟧]/g, "")
    .replace(/NOTA-/gi, "NOTA ")
    .replace(/<\/?\s*(respuesta_candidato|pregunta|rubrica|system)\s*>/gi, "")
    .trim();
  if (limpio.length === 0 || limpio.length > MAX_RESPUESTA) return null;
  return limpio;
}
