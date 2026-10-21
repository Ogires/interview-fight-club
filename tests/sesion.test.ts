import { describe, expect, it } from "vitest";
import { puedeResponder, RESERVA_MS } from "../src/dominio/sesion";

const base = { estado: "en_curso" as const, nPregunta: 1, reservaMs: null };

describe("puedeResponder", () => {
  it("acepta la siguiente pregunta", () => expect(puedeResponder(base, 2, 0)).toBeNull());
  it("rechaza fuera de orden (saltar o repetir)", () => {
    expect(puedeResponder(base, 3, 0)).toBe("fuera_de_orden");
    expect(puedeResponder(base, 1, 0)).toBe("fuera_de_orden");
  });
  it("rechaza en sesión terminada", () => {
    expect(puedeResponder({ ...base, estado: "terminada" }, 2, 0)).toBe("terminada");
  });
  it("rechaza con reserva vigente y acepta con reserva caducada", () => {
    expect(puedeResponder({ ...base, reservaMs: 1000 }, 2, 1000 + RESERVA_MS - 1)).toBe("reservada");
    expect(puedeResponder({ ...base, reservaMs: 1000 }, 2, 1000 + RESERVA_MS)).toBeNull();
  });
});
