import type { Env } from "./env";
export { Contador } from "./contadores/contador";

export default {
  async fetch(): Promise<Response> {
    return new Response("Esta vacante ya no existe", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
