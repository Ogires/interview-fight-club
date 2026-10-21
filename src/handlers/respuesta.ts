// src/handlers/respuesta.ts — el camino crítico (diseño §3.1)
import type { Env } from "../env";
import { fraseReserva, villanoPorId } from "../dominio/catalogo";
import { notaFinal, notaHeuristica } from "../dominio/nota";
import { generarNonce, promptReaccion } from "../dominio/prompt";
import { sanearRespuesta } from "../dominio/saneado";
import { puedeResponder, TOTAL_PREGUNTAS } from "../dominio/sesion";
import { limitar, sumarTokens } from "../contadores/uso";
import { construirCadena, depsCadena, primeraRespuesta } from "../ia/cadena";
import { CABECERAS_SSE, streamDegradado, streamReaccion, type Esperar, type FinTurno } from "../ia/stream";
import { leerPregunta } from "../repos/preguntas";
import { completarTurno, leerSesion, liberarTurno, reservarTurno } from "../repos/sesiones";
import { esUuid, ip, json, leerJson, recortar } from "../http/util";
import { demasiadas, desconocida, ilegible } from "./entrevista";

const MAX_COMENTARIO = 400;

export async function responder(request: Request, env: Env, esperar?: Esperar): Promise<Response> {
  const rl = await limitar(env, "respuesta", ip(request), 20);
  if (!rl.permitido) return demasiadas(rl.retryAfter);

  const b = await leerJson(request);
  const n = b?.n;
  const respuesta = sanearRespuesta(b?.respuesta);
  if (!b || !esUuid(b.sesion) || !Number.isInteger(n) || (n as number) < 1 || (n as number) > TOTAL_PREGUNTAS || !respuesta) return ilegible();
  const turno = n as number;

  const s = await leerSesion(env.DB, b.sesion);
  if (!s) return desconocida();
  // Bloqueo optimista ANTES de gastar tokens: un doble clic no paga dos veces
  const rechazo = puedeResponder(s, turno, Date.now());
  if (rechazo || !(await reservarTurno(env.DB, s.id, turno, Date.now()))) {
    return json({ error: rechazo ?? "reservada", mensaje: "Ese turno ya está en marcha o respondido" }, 409);
  }

  const liberar = () => liberarTurno(env.DB, s.id);
  // Si D1 cae aquí, la reserva caduca sola a los 30 s (RESERVA_MS)
  const preguntaTurno = await leerPregunta(env.DB, s.preguntas[turno - 1]);
  const villano = villanoPorId(s.villano);
  if (!preguntaTurno || !villano) {
    await liberar().catch(() => {});
    throw new Error("sesión inconsistente");
  }

  // Un único nonce por petición: el mismo en el prompt y en el extractor de la nota
  const nonce = generarNonce();
  const prompt = promptReaccion(villano, s.nivel, preguntaTurno, respuesta, nonce);

  const terminar = async (texto: string, notaIa: number | null, tokens: number | null, modelo: string | null): Promise<FinTurno> => {
    const nota = notaFinal(notaIa, respuesta, preguntaTurno.rubrica);
    if (notaIa !== null && nota < notaIa) console.log(JSON.stringify({ evento: "nota_recortada", ia: notaIa, final: nota }));
    if (!(await completarTurno(env.DB, s.id, turno, nota, recortar(texto, MAX_COMENTARIO)))) throw new Error("turno perdido");
    if (modelo) {
      // Si el proveedor no manda usage, se estima con caracteres/4 (diseño §3.2)
      const gastados = tokens ?? Math.ceil((prompt.system.length + prompt.user.length + texto.length) / 4);
      await sumarTokens(env, modelo, gastados).catch(() => {});
    }
    const siguiente = turno < TOTAL_PREGUNTAS ? await leerPregunta(env.DB, s.preguntas[turno]) : null;
    return { n: turno, nota, siguiente: siguiente && { n: turno + 1, texto: siguiente.texto } };
  };

  let elegido;
  try {
    elegido = await primeraRespuesta(construirCadena(env), { ...prompt, maxTokens: 800, stream: true }, depsCadena(env));
  } catch (err) {
    // KV del disyuntor caído, etc.: fail-closed al modo degradado
    console.error(JSON.stringify({ evento: "cadena_error", mensaje: String(err) }));
    elegido = null;
  }
  const reserva = fraseReserva(villano, notaHeuristica(respuesta, preguntaTurno.rubrica));

  const cuerpo = elegido
    ? streamReaccion({
        upstream: elegido.respuesta.body!,
        nonce,
        textoSiVacio: reserva,
        alTerminar: (r) => terminar(r.texto, r.nota, r.tokens, elegido.proveedor.id),
        alFallar: liberar,
        esperar,
      })
    : streamDegradado(
        reserva,
        async () => {
          try {
            return await terminar(reserva, null, null, null);
          } catch (err) {
            await liberar().catch(() => {});
            throw err;
          }
        },
        esperar
      );
  return new Response(cuerpo, { headers: CABECERAS_SSE });
}
