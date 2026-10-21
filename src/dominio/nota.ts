import { conceptosMencionados, type Concepto } from "./texto";

const MAX_MARCA = 32; // "⟦NOTA-xxxxxxxx:10⟧" con margen

// La marca puede llegar partida entre chunks: se retiene desde el último "⟦" hasta ver
// el "⟧". Solo la marca con el nonce de esta petición da nota (LLM01); cualquier otra
// marca se oculta. Lo que el modelo escriba después de la marca válida se descarta.
export function crearExtractorNota(nonce: string) {
  const valida = new RegExp(`^⟦NOTA-${nonce}:(\\d{1,2})⟧$`);
  let pendiente = "";
  let nota: number | null = null;

  function procesar(final: boolean): string {
    let salida = "";
    while (pendiente.length > 0 && nota === null) {
      const i = pendiente.indexOf("⟦");
      if (i < 0) {
        salida += pendiente;
        pendiente = "";
        break;
      }
      salida += pendiente.slice(0, i);
      pendiente = pendiente.slice(i);
      const j = pendiente.indexOf("⟧");
      if (j < 0) {
        if (!final && pendiente.length < MAX_MARCA) break; // quizá una marca a medias
        salida += pendiente[0]; // no era una marca: el "⟦" sale como texto
        pendiente = pendiente.slice(1);
        continue;
      }
      const m = valida.exec(pendiente.slice(0, j + 1));
      pendiente = pendiente.slice(j + 1);
      if (m) {
        nota = Math.min(10, parseInt(m[1], 10));
        pendiente = "";
      }
    }
    return salida;
  }

  return {
    empujar(texto: string): string {
      if (nota !== null) return "";
      pendiente += texto;
      return procesar(false);
    },
    cerrar(): { resto: string; nota: number | null } {
      return { resto: procesar(true), nota };
    },
  };
}

const MIN_LONGITUD = 40;

export function topeHeuristico(respuesta: string, rubrica: Concepto[]): number {
  if (respuesta.trim().length < MIN_LONGITUD) return 2;
  return conceptosMencionados(respuesta, rubrica) === 0 ? 4 : 10;
}

export function notaHeuristica(respuesta: string, rubrica: Concepto[]): number {
  const base = Math.round((10 * conceptosMencionados(respuesta, rubrica)) / Math.max(1, rubrica.length));
  return Math.min(base, topeHeuristico(respuesta, rubrica));
}

export function notaFinal(notaIa: number | null, respuesta: string, rubrica: Concepto[]): number {
  if (notaIa === null) return notaHeuristica(respuesta, rubrica);
  return Math.min(Math.max(0, Math.round(notaIa)), topeHeuristico(respuesta, rubrica));
}
