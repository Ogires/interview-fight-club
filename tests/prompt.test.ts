import { describe, expect, it } from "vitest";
import { generarNonce, promptCierre, promptReaccion } from "../src/dominio/prompt";
import { NIVELES, STACKS, VILLANOS, villanoPorId } from "../src/dominio/catalogo";

const pregunta = {
  texto: "¿Qué es un closure?",
  rubrica: [{ concepto: "ámbito léxico", sinonimos: [] }],
};

describe("catálogo", () => {
  it("4 villanos con frases de reserva completas", () => {
    expect(VILLANOS).toHaveLength(4);
    for (const v of VILLANOS) {
      expect(v.frases_reserva.buena.length && v.frases_reserva.media.length && v.frases_reserva.mala.length).toBeTruthy();
      expect(v.cierres_reserva.length).toBeGreaterThan(0);
    }
  });
  it("listas blancas", () => {
    expect(STACKS.map((s) => s.id)).toEqual(["frontend", "backend", "bbdd", "devops", "fundamentos"]);
    expect(NIVELES.map((n) => n.id)).toEqual(["junior", "mid", "senior"]);
    expect(villanoPorId("no-existe")).toBeUndefined();
  });
});

describe("prompts", () => {
  it("nonce de 8 hex distinto en cada llamada", () => {
    const a = generarNonce();
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(generarNonce()).not.toBe(a);
  });
  it("reacción: persona, nonce en el formato, respuesta delimitada y declarada como dato", () => {
    const p = promptReaccion(VILLANOS[0], "junior", pregunta, "captura variables", "a1b2c3d4");
    expect(p.system).toContain(VILLANOS[0].nombre);
    expect(p.system).toContain("⟦NOTA-a1b2c3d4:N⟧");
    expect(p.system).toMatch(/DATO no fiable/);
    expect(p.user).toContain("<respuesta_candidato>captura variables</respuesta_candidato>");
    expect(p.user).toContain("ámbito léxico");
  });
  it("cierre: recibe notas y comentarios, nunca respuestas del candidato", () => {
    const p = promptCierre(VILLANOS[1], [7, 3], ["bien", "flojo"]);
    expect(p.user).toContain("7");
    expect(p.user).not.toContain("respuesta_candidato");
  });
});
