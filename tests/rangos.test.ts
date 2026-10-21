import { describe, expect, it } from "vitest";
import { media, rangoDe } from "../src/dominio/rangos";

describe("rangos (fronteras del diseño §2.2)", () => {
  it.each([
    [0, "Te llamaremos (no)"], [2.9, "Te llamaremos (no)"],
    [3, "Becario Eterno"], [4.9, "Becario Eterno"],
    [5, "Contratado… a prueba"], [6.9, "Contratado… a prueba"],
    [7, "Oferta con stock options sin valor"], [8.9, "Oferta con stock options sin valor"],
    [9, "Te ofrecen el puesto del entrevistador"], [10, "Te ofrecen el puesto del entrevistador"],
  ])("%d → %s", (m, r) => expect(rangoDe(m)).toBe(r));

  it("media con un decimal", () => expect(media([7, 3, 5, 4, 8])).toBe(5.4));
});
