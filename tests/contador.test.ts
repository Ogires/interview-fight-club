// tests/contador.test.ts
import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

const stub = (nombre: string) => env.CONTADOR.get(env.CONTADOR.idFromName(nombre));
const T = 100_000; // segundo 40 de una ventana de 60 s

describe("Contador.consumir (ventana fija)", () => {
  it("es exacto con 100 peticiones concurrentes: deja pasar justo el límite", async () => {
    const c = stub("rl:concurrencia");
    const r = await Promise.all(Array.from({ length: 100 }, () => c.consumir(20, 60_000, T)));
    expect(r.filter((x) => x.permitido)).toHaveLength(20); // el test que KV suspende (lección 9)
  });

  it("al bloquear informa de los segundos reales hasta la siguiente ventana", async () => {
    const c = stub("rl:retry");
    await c.consumir(1, 60_000, T);
    expect(await c.consumir(1, 60_000, T + 5_000)).toEqual({ permitido: false, retryAfter: 15 });
  });

  it("la ventana siguiente empieza de cero", async () => {
    const c = stub("rl:ventana");
    await c.consumir(1, 60_000, T);
    expect((await c.consumir(1, 60_000, T + 20_000)).permitido).toBe(true);
  });
});

describe("Contador.sumar/leer (presupuesto)", () => {
  it("suma concurrente sin perder incrementos", async () => {
    const c = stub("tokens:2026-10-21:modelo");
    await Promise.all(Array.from({ length: 50 }, () => c.sumar(10)));
    expect(await c.leer()).toBe(500);
  });

  it("empieza en 0", async () => {
    expect(await stub("tokens:vacio").leer()).toBe(0);
  });
});
