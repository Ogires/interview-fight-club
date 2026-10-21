// src/ia/proveedor.ts — adaptador OpenAI-compatible (hoy Groq)
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface PeticionLlm {
  system: string;
  user: string;
  maxTokens: number;
  stream: boolean;
}

// Strategy: hoy solo Groq, pero cualquier API OpenAI-compatible entra con otra fábrica
export interface LlmProvider {
  id: string; // clave del disyuntor y del presupuesto
  llamar(p: PeticionLlm, signal: AbortSignal): Promise<Response>;
}

// Verificado en la Tarea 0: gpt-oss quema tokens razonando si no se acota; qwen saca el
// razonamiento por el contenido si no se oculta
export function opcionesDeRazonamiento(modelo: string): Record<string, string> {
  if (modelo.startsWith("openai/gpt-oss")) return { reasoning_effort: "low" };
  if (modelo.startsWith("qwen/")) return { reasoning_format: "hidden" };
  return {};
}

export function proveedorGroq(apiKey: string, modelo: string): LlmProvider {
  return {
    id: modelo,
    llamar(p, signal) {
      return fetch(GROQ_URL, {
        method: "POST",
        signal,
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: p.system },
            { role: "user", content: p.user },
          ],
          max_tokens: p.maxTokens,
          temperature: 0.8,
          stream: p.stream,
          ...opcionesDeRazonamiento(modelo),
        }),
      });
    },
  };
}
