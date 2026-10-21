// src/ia/stream.ts — stream de reacción propio hacia el navegador (texto/nota/error)
import { crearExtractorNota } from "../dominio/nota";
import { leerSseOpenAi } from "./sse";

export const CABECERAS_SSE = { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" };

export interface FinTurno {
  n: number;
  nota: number;
  siguiente: { n: number; texto: string } | null;
}

// Registra el trabajo pendiente en ctx.waitUntil (lección 2): si el cliente se desconecta,
// la persistencia del turno debe terminar igualmente
export type Esperar = (p: Promise<unknown>) => void;

const codificador = new TextEncoder();
const MENSAJE_ERROR = "El entrevistador ha salido a por un café. Repite la respuesta";

function emisor(controller: ReadableStreamDefaultController<Uint8Array>) {
  return (evento: string, datos: unknown) => {
    try {
      controller.enqueue(codificador.encode(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`));
    } catch {
      // el cliente se fue: se sigue para persistir el turno igualmente
    }
  };
}

function cerrar(controller: ReadableStreamDefaultController<Uint8Array>): void {
  try {
    controller.close();
  } catch {
    /* ya cerrado */
  }
}

// Pipes & Filters: SSE del proveedor → extractor de nota → eventos propios. La persistencia
// (alTerminar) ocurre ANTES del evento final porque este lleva la siguiente pregunta
export function streamReaccion(o: {
  upstream: ReadableStream<Uint8Array>;
  nonce: string;
  textoSiVacio: string;
  alTerminar(r: { texto: string; nota: number | null; tokens: number | null }): Promise<FinTurno>;
  alFallar(): Promise<void>;
  esperar?: Esperar;
}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const trabajo = (async () => {
        const enviar = emisor(controller);
        const extractor = crearExtractorNota(o.nonce);
        let texto = "";
        let tokens: number | null = null;
        const emitir = (t: string) => {
          if (!t) return;
          texto += t;
          enviar("texto", { t });
        };
        try {
          try {
            for await (const d of leerSseOpenAi(o.upstream)) {
              if (d.tokens !== undefined) tokens = d.tokens;
              if (d.texto) emitir(extractor.empujar(d.texto));
            }
          } catch (err) {
            // §3.1.7: stream cortado → se cierra con lo recibido (sin marca = nota heurística)
            console.error(JSON.stringify({ evento: "stream_error", fase: "proveedor", mensaje: String(err) }));
          }
          const { resto, nota } = extractor.cerrar();
          emitir(resto);
          if (!texto.trim()) emitir(o.textoSiVacio);
          enviar("nota", await o.alTerminar({ texto, nota, tokens }));
        } catch (err) {
          console.error(JSON.stringify({ evento: "stream_error", mensaje: String(err) }));
          await o.alFallar().catch(() => {});
          enviar("error", { mensaje: MENSAJE_ERROR });
        }
        cerrar(controller);
      })();
      o.esperar?.(trabajo);
      return trabajo;
    },
  });
}

// Sin IA: frase precocinada del villano + nota heurística. La demo nunca en blanco
export function streamDegradado(frase: string, alTerminar: () => Promise<FinTurno>, esperar?: Esperar): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const trabajo = (async () => {
        const enviar = emisor(controller);
        for (const palabra of frase.split(" ")) enviar("texto", { t: palabra + " " });
        try {
          enviar("nota", await alTerminar());
        } catch (err) {
          console.error(JSON.stringify({ evento: "stream_error", mensaje: String(err) }));
          enviar("error", { mensaje: MENSAJE_ERROR });
        }
        cerrar(controller);
      })();
      esperar?.(trabajo);
      return trabajo;
    },
  });
}
