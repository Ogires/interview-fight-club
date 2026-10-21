import { afterEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { proveedorGroq } from "../src/ia/proveedor";
import { primeraRespuesta } from "../src/ia/cadena";
import { mockGroq, restaurarFetch, sseGroq } from "./helpers";

afterEach(restaurarFetch);

const peticion = { system: "s", user: "u", maxTokens: 800, stream: true };
const cadena = () => ["m/uno", "m/dos", "m/tres"].map((m) => proveedorGroq("k", m));
const deps = (usados: Record<string, number> = {}) => ({
  kv: env.KV,
  cuota: 1000,
  leerTokens: async (id: string) => usados[id] ?? 0,
});

describe("primeraRespuesta", () => {
  it("usa el primer modelo si responde", async () => {
    const llamadas = mockGroq(() => sseGroq(["ok"]));
    const r = await primeraRespuesta(cadena(), peticion, deps());
    expect(r?.proveedor.id).toBe("m/uno");
    expect(llamadas.map((l) => l.model)).toEqual(["m/uno"]);
  });

  it("429 → siguiente modelo y abre el disyuntor del caído", async () => {
    mockGroq((p) => (p.model === "m/uno" ? new Response("cuota", { status: 429, headers: { "retry-after": "120" } }) : sseGroq(["ok"])));
    const r = await primeraRespuesta(cadena(), peticion, deps());
    expect(r?.proveedor.id).toBe("m/dos");
    expect(await env.KV.get("caido:m/uno")).not.toBeNull();
    await env.KV.delete("caido:m/uno"); // no contaminar los tests siguientes
  });

  it("con el disyuntor abierto ni siquiera lo llama", async () => {
    await env.KV.put("caido:m/uno", "1", { expirationTtl: 60 });
    const llamadas = mockGroq(() => sseGroq(["ok"]));
    await primeraRespuesta(cadena(), peticion, deps());
    expect(llamadas.map((l) => l.model)).toEqual(["m/dos"]);
    await env.KV.delete("caido:m/uno");
  });

  it("salta los modelos con el presupuesto al 90 %", async () => {
    const llamadas = mockGroq(() => sseGroq(["ok"]));
    const r = await primeraRespuesta(cadena(), peticion, deps({ "m/uno": 900, "m/dos": 950 }));
    expect(r?.proveedor.id).toBe("m/tres");
    expect(llamadas).toHaveLength(1);
  });

  it("todos caídos (5xx o excepción) → null, nunca lanza", async () => {
    mockGroq(() => {
      throw new Error("red");
    });
    expect(await primeraRespuesta(cadena(), peticion, deps())).toBeNull();
  });

  it("si el presupuesto no se puede leer → null sin llamar (fail-closed, A10)", async () => {
    const llamadas = mockGroq(() => sseGroq(["ok"]));
    const r = await primeraRespuesta(cadena(), peticion, {
      ...deps(),
      leerTokens: async () => {
        throw new Error("DO caído");
      },
    });
    expect(r).toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it("razonamiento: reasoning_effort en gpt-oss, reasoning_format en qwen", async () => {
    const llamadas = mockGroq(() => sseGroq(["ok"]));
    await primeraRespuesta([proveedorGroq("k", "openai/gpt-oss-120b")], peticion, deps());
    await primeraRespuesta([proveedorGroq("k", "qwen/qwen3.8-27b")], peticion, deps());
    expect((llamadas[0] as any).reasoning_effort).toBe("low");
    expect((llamadas[1] as any).reasoning_format).toBe("hidden");
  });
});
