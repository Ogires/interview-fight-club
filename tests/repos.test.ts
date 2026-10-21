import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { leerPregunta, sortearPreguntas } from "../src/repos/preguntas";
import { completarTurno, crearSesion, leerSesion, liberarTurno, reservarTurno } from "../src/repos/sesiones";
import { guardarVeredicto, leerVeredicto } from "../src/repos/veredictos";

async function nuevaSesion() {
  const id = crypto.randomUUID();
  const preguntas = await sortearPreguntas(env.DB, "frontend", "junior", 5);
  await crearSesion(env.DB, { id, alias: "Candidato-AB12", stack: "frontend", nivel: "junior", villano: "senior-amargado", preguntas });
  return id;
}

describe("preguntas", () => {
  it("sortea 5 distintas del stack y nivel pedidos, sin mezclar", async () => {
    const ids = await sortearPreguntas(env.DB, "frontend", "junior", 5);
    expect(new Set(ids).size).toBe(5);
    expect(ids.every((i) => i.startsWith("frontend-junior"))).toBe(true);
  });
  it("lee la pregunta con la rúbrica parseada", async () => {
    const p = await leerPregunta(env.DB, "frontend-junior-001");
    expect(p?.rubrica[0].concepto).toBeTypeOf("string");
  });
});

describe("sesiones", () => {
  it("reserva el turno una sola vez (bloqueo optimista)", async () => {
    const id = await nuevaSesion();
    const [a, b] = await Promise.all([reservarTurno(env.DB, id, 1, 1000), reservarTurno(env.DB, id, 1, 1000)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
  it("completa el turno: nota y comentario anexados, avanza y libera la reserva", async () => {
    const id = await nuevaSesion();
    await reservarTurno(env.DB, id, 1, 1000);
    expect(await completarTurno(env.DB, id, 1, 7, "Bien")).toBe(true);
    const s = await leerSesion(env.DB, id);
    expect(s).toMatchObject({ nPregunta: 1, notas: [7], comentarios: ["Bien"], reservaMs: null, estado: "en_curso" });
  });
  it("el 5.º turno termina la sesión", async () => {
    const id = await nuevaSesion();
    for (let n = 1; n <= 5; n++) {
      await reservarTurno(env.DB, id, n, n * 100_000);
      await completarTurno(env.DB, id, n, 5, "x");
    }
    expect((await leerSesion(env.DB, id))?.estado).toBe("terminada");
  });
  it("liberar permite reintentar el turno", async () => {
    const id = await nuevaSesion();
    await reservarTurno(env.DB, id, 1, 1000);
    await liberarTurno(env.DB, id);
    expect(await reservarTurno(env.DB, id, 1, 2000)).toBe(true);
  });
});

describe("veredictos", () => {
  const datos = (publicoId: string) => ({
    publicoId, alias: "Candidato-AB12", stack: "frontend", nivel: "junior", villano: "senior-amargado",
    media: 5.4, rango: "Contratado… a prueba", fraseFinal: "Te llamaremos.", desglose: [],
  });
  it("guarda una vez y es idempotente: la segunda llamada devuelve el primer id", async () => {
    const id = await nuevaSesion();
    await env.DB.prepare("UPDATE sesiones SET estado='terminada' WHERE id=?").bind(id).run();
    expect(await guardarVeredicto(env.DB, id, datos("AAAAAAAAAAAA"))).toBe("AAAAAAAAAAAA");
    expect(await guardarVeredicto(env.DB, id, datos("BBBBBBBBBBBB"))).toBe("AAAAAAAAAAAA");
    expect(await leerVeredicto(env.DB, "BBBBBBBBBBBB")).toBeNull();
    expect((await leerVeredicto(env.DB, "AAAAAAAAAAAA"))?.media).toBe(5.4);
  });
  it("no guarda si la sesión no ha terminado", async () => {
    const id = await nuevaSesion();
    expect(await guardarVeredicto(env.DB, id, datos("CCCCCCCCCCCC"))).toBeNull();
  });
});
