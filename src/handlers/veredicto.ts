// src/handlers/veredicto.ts — cierre de la entrevista y veredicto público inmutable
import type { Env } from "../env";
import { villanoPorId, aleatorio } from "../dominio/catalogo";
import { promptCierre } from "../dominio/prompt";
import { media, rangoDe } from "../dominio/rangos";
import { limitar, sumarTokens } from "../contadores/uso";
import { construirCadena, depsCadena, primeraRespuesta } from "../ia/cadena";
import { leerPregunta } from "../repos/preguntas";
import { leerSesion } from "../repos/sesiones";
import { guardarVeredicto, leerVeredicto, type Veredicto } from "../repos/veredictos";
import { esUuid, idPublico, ip, json, leerJson, recortar } from "../http/util";
import { demasiadas, desconocida, ilegible } from "./entrevista";

const MAX_FRASE = 200;
export const ES_ID_PUBLICO = /^[A-Za-z0-9]{12}$/;

async function fraseFinal(env: Env, villanoId: string, notas: number[], comentarios: string[]): Promise<string> {
  const v = villanoPorId(villanoId)!;
  try {
    const elegido = await primeraRespuesta(construirCadena(env), { ...promptCierre(v, notas, comentarios), maxTokens: 500, stream: false }, depsCadena(env));
    if (elegido) {
      const datos = (await elegido.respuesta.json()) as any;
      const frase = String(datos?.choices?.[0]?.message?.content ?? "").replace(/[⟦⟧]/g, "").trim();
      const tokens = datos?.usage?.total_tokens;
      if (typeof tokens === "number") await sumarTokens(env, elegido.proveedor.id, tokens).catch(() => {});
      if (frase) return recortar(frase, MAX_FRASE);
    }
  } catch {
    /* cae a la reserva */
  }
  return aleatorio(v.cierres_reserva);
}

export async function cerrarEntrevista(request: Request, env: Env): Promise<Response> {
  // Defensa extra (LLM10): el cierre también llama a la IA
  const rl = await limitar(env, "veredicto", ip(request), 10);
  if (!rl.permitido) return demasiadas(rl.retryAfter);

  const b = await leerJson(request);
  const sesionId = b?.sesion;
  if (!esUuid(sesionId)) return ilegible();
  const s = await leerSesion(env.DB, sesionId);
  if (!s) return desconocida();
  if (s.publicoId) return json({ publico_id: s.publicoId, url: `/r/${s.publicoId}` });
  if (s.estado !== "terminada") return json({ error: "en_curso", mensaje: "Aún no hemos terminado contigo" }, 409);

  const preguntas = await Promise.all(s.preguntas.map((p) => leerPregunta(env.DB, p)));
  const m = media(s.notas);
  const v: Veredicto = {
    publicoId: idPublico(), alias: s.alias, stack: s.stack, nivel: s.nivel, villano: s.villano,
    media: m, rango: rangoDe(m), fraseFinal: await fraseFinal(env, s.villano, s.notas, s.comentarios),
    desglose: preguntas.map((p, i) => ({ pregunta: p!.texto, nota: s.notas[i], comentario: s.comentarios[i], esperado: p!.esperado })),
  };
  // Si otra petición ganó la carrera, guardarVeredicto devuelve SU id (idempotente)
  const id = await guardarVeredicto(env.DB, s.id, v);
  if (!id) throw new Error("veredicto no guardado");
  return json({ publico_id: id, url: `/r/${id}` });
}

export async function veredictoPublico(id: string, env: Env): Promise<Response> {
  const v = ES_ID_PUBLICO.test(id) ? await leerVeredicto(env.DB, id) : null;
  if (!v) return json({ error: "no_existe", mensaje: "Este veredicto no consta en RRHH" }, 404);
  const villano = villanoPorId(v.villano)!;
  return json(
    { alias: v.alias, stack: v.stack, nivel: v.nivel, villano: { nombre: villano.nombre, emoji: villano.emoji }, media: v.media, rango: v.rango, frase_final: v.fraseFinal, desglose: v.desglose, creado: v.creadoMs },
    200,
    { "cache-control": "public, max-age=3600" } // inmutable
  );
}

// og dinámicos: HTMLRewriter.setAttribute escapa el contenido (LLM05)
export async function paginaVeredicto(request: Request, id: string, env: Env): Promise<Response> {
  // Ojo: assets sirve r.html en "/r" (html_handling quita la extensión; pedir "/r.html" devuelve un 307)
  const pagina = await env.ASSETS.fetch(new Request(new URL("/r", request.url)));
  const v = ES_ID_PUBLICO.test(id) ? await leerVeredicto(env.DB, id) : null;
  const cabeceras = new Headers(pagina.headers);
  cabeceras.delete("etag"); // el ETag es el de r.html genérico, no el de este veredicto
  if (!v) return new Response(pagina.body, { status: 404, headers: cabeceras });
  const villano = villanoPorId(v.villano)!;
  const titulo = `${villano.nombre} me ha dado un ${v.media.toFixed(1).replace(".", ",")}/10 en Interview Fight Club`;
  const descripcion = `${v.rango}. «${v.fraseFinal}»`;
  return new HTMLRewriter()
    .on("title", { element: (e) => void e.setInnerContent(titulo) })
    .on('meta[property="og:title"]', { element: (e) => void e.setAttribute("content", titulo) })
    .on('meta[property="og:description"]', { element: (e) => void e.setAttribute("content", descripcion) })
    .on('meta[name="description"]', { element: (e) => void e.setAttribute("content", descripcion) })
    .transform(new Response(pagina.body, { status: 200, headers: cabeceras }));
}
