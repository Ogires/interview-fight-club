// src/handlers/entrevista.ts — crear la entrevista y recuperar su estado
import type { Env } from "../env";
import { esNivel, esStack, villanoPorId } from "../dominio/catalogo";
import { TOTAL_PREGUNTAS } from "../dominio/sesion";
import { limitar } from "../contadores/uso";
import { leerPregunta, sortearPreguntas } from "../repos/preguntas";
import { crearSesion, leerSesion } from "../repos/sesiones";
import { aliasPorDefecto, esUuid, ip, json, leerJson, validarAlias } from "../http/util";

export const demasiadas = (retryAfter: number) =>
  json({ error: "rate_limit", mensaje: "Demasiadas entrevistas. Hasta los headhunters descansan", segundos: retryAfter }, 429, {
    "retry-after": String(retryAfter),
  });
export const ilegible = () => json({ error: "invalido", mensaje: "El entrevistador no entiende tu letra" }, 400);
export const desconocida = () => json({ error: "sesion", mensaje: "Esta entrevista no consta en RRHH" }, 404);

export async function crearEntrevista(request: Request, env: Env): Promise<Response> {
  const rl = await limitar(env, "entrevista", ip(request), 5);
  if (!rl.permitido) return demasiadas(rl.retryAfter);

  const b = await leerJson(request);
  const villano = villanoPorId(b?.villano);
  if (!b || !esStack(b.stack) || !esNivel(b.nivel) || !villano) return ilegible();
  const stack = b.stack;
  const nivel = b.nivel;
  const alias = b.alias === undefined || b.alias === "" ? aliasPorDefecto() : validarAlias(b.alias);
  if (!alias) return ilegible();

  const preguntas = await sortearPreguntas(env.DB, stack, nivel, TOTAL_PREGUNTAS);
  if (preguntas.length < TOTAL_PREGUNTAS) throw new Error(`banco insuficiente: ${stack}/${nivel}`);
  const sesion = crypto.randomUUID();
  await crearSesion(env.DB, { id: sesion, alias, stack, nivel, villano: villano.id, preguntas });
  const primera = await leerPregunta(env.DB, preguntas[0]);
  return json({ sesion, alias, saludo: villano.saludo, pregunta: { n: 1, total: TOTAL_PREGUNTAS, texto: primera!.texto } }, 201);
}

// Recuperar al recargar: notas y comentarios, nunca las respuestas (no se guardan)
export async function estadoEntrevista(url: URL, env: Env): Promise<Response> {
  const id = url.searchParams.get("sesion");
  if (!esUuid(id)) return ilegible();
  const s = await leerSesion(env.DB, id);
  if (!s) return desconocida();
  const preguntas = await Promise.all(s.preguntas.slice(0, s.nPregunta + 1).map((p) => leerPregunta(env.DB, p)));
  return json({
    stack: s.stack, nivel: s.nivel, villano: s.villano, alias: s.alias, estado: s.estado, n_pregunta: s.nPregunta,
    turnos: s.notas.map((nota, i) => ({ pregunta: preguntas[i]!.texto, nota, comentario: s.comentarios[i] })),
    pregunta_actual: s.estado === "en_curso" ? { n: s.nPregunta + 1, total: TOTAL_PREGUNTAS, texto: preguntas[s.nPregunta]!.texto } : null,
    publico_id: s.publicoId,
  });
}
