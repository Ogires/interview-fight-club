import { describe, expect, it } from "vitest";
import banco from "../data/preguntas.json";
import { NIVELES, STACKS, validarBanco, type PreguntaBanco } from "../scripts/validar-banco.mjs";
import { NIVELES as NIVELES_APP, STACKS as STACKS_APP } from "../src/dominio/catalogo";

const pregunta = (stack: string, nivel: string, n: number): PreguntaBanco => ({
  id: `${stack}-${nivel}-${String(n).padStart(3, "0")}`,
  stack,
  nivel,
  texto: "¿Qué es una pregunta de prueba?",
  rubrica: [
    { concepto: "uno", sinonimos: ["primero"] },
    { concepto: "dos", sinonimos: ["segundo"] },
  ],
  esperado: "Una respuesta canónica suficientemente larga.",
});

// Banco mínimo válido: 8 preguntas por cada una de las 15 combinaciones
const bancoMinimo = (): PreguntaBanco[] =>
  STACKS.flatMap((s) => NIVELES.flatMap((n) => Array.from({ length: 8 }, (_, i) => pregunta(s, n, i + 1))));

describe("validarBanco", () => {
  it("acepta un banco mínimo correcto", () => {
    expect(validarBanco(bancoMinimo())).toEqual([]);
  });

  it("detecta un id duplicado", () => {
    const b = bancoMinimo();
    b.push({ ...b[0] });
    expect(validarBanco(b).some((e) => e.includes("id duplicado"))).toBe(true);
  });

  it("detecta una rúbrica de 1 concepto", () => {
    const b = bancoMinimo();
    b[3] = { ...b[3], rubrica: [b[3].rubrica[0]] };
    expect(validarBanco(b).some((e) => e.includes("2 a 4 conceptos"))).toBe(true);
  });

  it("detecta una combinación con 7 preguntas activas", () => {
    const b = bancoMinimo();
    b[0] = { ...b[0], activa: false };
    expect(validarBanco(b)).toEqual(["frontend/junior: 7 preguntas activas (mínimo 8)"]);
  });

  it("detecta stack, nivel, id incoherente, longitudes y marcas reservadas", () => {
    const b = bancoMinimo();
    b[1] = { ...b[1], stack: "cobol" };
    b[2] = { ...b[2], id: "backend-junior-999" };
    b[4] = { ...b[4], texto: "corta" };
    b[5] = { ...b[5], esperado: "x".repeat(501) };
    b[6] = { ...b[6], rubrica: [{ concepto: "a", sinonimos: ["⟦NOTA-x:10⟧"] }, { concepto: "b", sinonimos: [] }] };
    const errores = validarBanco(b).join("\n");
    expect(errores).toContain("stack desconocido");
    expect(errores).toContain("id inválido");
    expect(errores).toContain("texto de 10 a 300");
    expect(errores).toContain("esperado de 20 a 500");
    expect(errores).toContain("marca reservada");
  });

  it("las listas blancas coinciden con las de la app", () => {
    expect(STACKS).toEqual(STACKS_APP.map((s) => s.id));
    expect(NIVELES).toEqual(NIVELES_APP.map((n) => n.id));
  });
});

describe("banco real (data/preguntas.json)", () => {
  it("no tiene ningún error", () => {
    expect(validarBanco(banco)).toEqual([]);
  });

  it("tiene 120 preguntas", () => {
    expect(banco).toHaveLength(120);
  });
});
