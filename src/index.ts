// src/index.ts — router + cabeceras de seguridad + try/catch global (A10)
import type { Env } from "./env";
import { conCabeceras } from "./http/cabeceras";
import { json } from "./http/util";
import { opciones } from "./handlers/opciones";
import { crearEntrevista, estadoEntrevista } from "./handlers/entrevista";
import { responder } from "./handlers/respuesta";
import { cerrarEntrevista, paginaVeredicto, veredictoPublico } from "./handlers/veredicto";
export { Contador } from "./contadores/contador";

type Ruta = (request: Request, env: Env, url: URL, param: string, ctx: ExecutionContext) => Promise<Response> | Response;

const RUTAS: { patron: RegExp; metodos: Record<string, Ruta> }[] = [
  { patron: /^\/api\/opciones$/, metodos: { GET: () => opciones() } },
  { patron: /^\/api\/entrevista$/, metodos: { POST: (r, e) => crearEntrevista(r, e), GET: (_r, e, u) => estadoEntrevista(u, e) } },
  // ctx.waitUntil (lección 2): el turno se persiste aunque el cliente cierre la pestaña
  { patron: /^\/api\/respuesta$/, metodos: { POST: (r, e, _u, _p, c) => responder(r, e, (p) => c.waitUntil(p)) } },
  { patron: /^\/api\/veredicto$/, metodos: { POST: (r, e) => cerrarEntrevista(r, e) } },
  { patron: /^\/api\/veredicto\/([^/]+)$/, metodos: { GET: (_r, e, _u, id) => veredictoPublico(id, e) } },
  { patron: /^\/r\/([^/]+)$/, metodos: { GET: (r, e, _u, id) => paginaVeredicto(r, id, e) } },
];

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return ""; // percent-encoding roto: no casa con ningún id válido → 404
  }
}

const noExiste = () => new Response("Esta vacante ya no existe", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

async function enrutar(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  for (const { patron, metodos } of RUTAS) {
    const m = patron.exec(url.pathname);
    if (!m) continue;
    const manejador = metodos[request.method];
    if (!manejador) return json({ error: "metodo" }, 405, { allow: Object.keys(metodos).join(", ") });
    return manejador(request, env, url, decodificar(m[1] ?? ""), ctx);
  }
  return noExiste();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return conCabeceras(await enrutar(request, env, ctx));
    } catch (err) {
      // A10: D1 o DO caídos → mensaje con gracia, nunca un stack
      console.error(JSON.stringify({ evento: "error_no_controlado", mensaje: String(err) }));
      return conCabeceras(json({ error: "mantenimiento", mensaje: "RRHH está en una dinámica de grupo. Vuelve en un rato" }, 503));
    }
  },
} satisfies ExportedHandler<Env>;
