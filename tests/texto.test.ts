import { describe, expect, it } from "vitest";
import { conceptosMencionados, normalizarTexto } from "../src/dominio/texto";

const rubrica = [
  { concepto: "ámbito de bloque", sinonimos: ["bloque", "block scope"] },
  { concepto: "hoisting", sinonimos: ["elevación"] },
];

describe("normalizarTexto", () => {
  it("minúsculas y sin tildes", () => expect(normalizarTexto("ÁMBITO Elevación")).toBe("ambito elevacion"));
});

describe("conceptosMencionados", () => {
  it("cuenta cada concepto una vez, por nombre o sinónimo, sin tildes", () => {
    expect(conceptosMencionados("Tiene ambito de BLOQUE y elevacion", rubrica)).toBe(2);
  });
  it("palabra completa: 'bloqueado' no menciona 'bloque' (lección 7)", () => {
    expect(conceptosMencionados("estoy bloqueado", rubrica)).toBe(0);
  });
  it("0 si no menciona nada", () => expect(conceptosMencionados("ni idea", rubrica)).toBe(0));
});
