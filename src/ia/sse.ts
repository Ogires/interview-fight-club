// src/ia/sse.ts — lector SSE OpenAI-compatible
export interface Delta {
  texto?: string;
  tokens?: number;
}

// Groq manda el uso en x_groq.usage del último chunk
export async function* leerSseOpenAi(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<Delta> {
  const lector = cuerpo.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await lector.read();
    if (done) return;
    buffer += value;
    let salto: number;
    while ((salto = buffer.indexOf("\n")) >= 0) {
      const linea = buffer.slice(0, salto).trim();
      buffer = buffer.slice(salto + 1);
      if (!linea.startsWith("data:")) continue;
      const dato = linea.slice(5).trim();
      if (dato === "[DONE]") return;
      try {
        const json = JSON.parse(dato);
        const texto = json?.choices?.[0]?.delta?.content;
        const tokens = json?.x_groq?.usage?.total_tokens ?? json?.usage?.total_tokens;
        yield {
          texto: typeof texto === "string" ? texto : undefined,
          tokens: typeof tokens === "number" ? tokens : undefined,
        };
      } catch {
        // línea malformada: se ignora
      }
    }
  }
}
