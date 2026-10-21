// tests/stream.test.ts
import { describe, expect, it } from "vitest";
import { streamDegradado, streamReaccion } from "../src/ia/stream";
import { leerEventos, sseGroq } from "./helpers";

const N = "a1b2c3d4";
const fin = { n: 1, nota: 7, siguiente: null };

describe("streamReaccion", () => {
  it("reenvía el texto sin la marca y entrega a alTerminar texto, nota y tokens", async () => {
    let recibido: any;
    const s = streamReaccion({
      upstream: sseGroq(["Correcto. ", `⟦NOTA-${N}`, ":7⟧"], 850).body!,
      nonce: N,
      textoSiVacio: "…",
      alTerminar: async (r) => ((recibido = r), fin),
      alFallar: async () => {},
    });
    const ev = await leerEventos(new Response(s));
    expect(ev.filter((e) => e.evento === "texto").map((e) => e.datos.t).join("")).toBe("Correcto. ");
    expect(ev.at(-1)).toEqual({ evento: "nota", datos: fin });
    expect(recibido).toEqual({ texto: "Correcto. ", nota: 7, tokens: 850 });
  });

  it("si el modelo no escribe nada, emite la frase de reserva", async () => {
    const s = streamReaccion({
      upstream: sseGroq([]).body!, nonce: N, textoSiVacio: "Con jQuery esto no pasaba.",
      alTerminar: async () => fin, alFallar: async () => {},
    });
    const ev = await leerEventos(new Response(s));
    expect(ev[0]).toEqual({ evento: "texto", datos: { t: "Con jQuery esto no pasaba." } });
  });

  it("si el proveedor corta el stream a mitad: se cierra el turno con lo recibido y sin nota IA", async () => {
    let recibido: any;
    const trozo = new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Empiezo bien" } }] })}\n\n`);
    let lecturas = 0;
    const upstream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (lecturas++ === 0) c.enqueue(trozo);
        else c.error(new Error("conexión cortada"));
      },
    });
    const s = streamReaccion({
      upstream, nonce: N, textoSiVacio: "",
      alTerminar: async (r) => ((recibido = r), fin), alFallar: async () => {},
    });
    const ev = await leerEventos(new Response(s));
    expect(ev.at(-1)).toEqual({ evento: "nota", datos: fin });
    expect(recibido).toEqual({ texto: "Empiezo bien", nota: null, tokens: null });
  });

  it("registra el trabajo en esperar (ctx.waitUntil) para persistir aunque el cliente se vaya", async () => {
    const pendientes: Promise<unknown>[] = [];
    const s = streamReaccion({
      upstream: sseGroq(["x"]).body!, nonce: N, textoSiVacio: "",
      alTerminar: async () => fin, alFallar: async () => {}, esperar: (p) => pendientes.push(p),
    });
    await leerEventos(new Response(s));
    expect(pendientes).toHaveLength(1);
  });

  it("si falla la persistencia: evento error y alFallar (libera el turno)", async () => {
    let liberado = false;
    const s = streamReaccion({
      upstream: sseGroq(["x"]).body!, nonce: N, textoSiVacio: "",
      alTerminar: async () => { throw new Error("D1"); },
      alFallar: async () => { liberado = true; },
    });
    const ev = await leerEventos(new Response(s));
    expect(ev.at(-1)?.evento).toBe("error");
    expect(liberado).toBe(true);
  });
});

describe("streamDegradado", () => {
  it("emite la frase palabra a palabra y luego la nota", async () => {
    const ev = await leerEventos(new Response(streamDegradado("Pivotamos a otra pregunta.", async () => fin)));
    expect(ev.filter((e) => e.evento === "texto").map((e) => e.datos.t).join("")).toBe("Pivotamos a otra pregunta. ");
    expect(ev.at(-1)?.evento).toBe("nota");
  });
});
