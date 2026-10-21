import { describe, expect, it } from "vitest";
import { leerSseOpenAi, type Delta } from "../src/ia/sse";
import { sseGroq } from "./helpers";

describe("leerSseOpenAi", () => {
  it("emite deltas de texto y los tokens del último chunk", async () => {
    const trozos: Delta[] = [];
    for await (const d of leerSseOpenAi(sseGroq(["Hola", " mundo"], 777).body!)) trozos.push(d);
    expect(trozos.map((t) => t.texto ?? "").join("")).toBe("Hola mundo");
    expect(trozos.at(-1)?.tokens).toBe(777);
  });
});
