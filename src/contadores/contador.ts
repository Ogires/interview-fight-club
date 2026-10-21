// src/contadores/contador.ts
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

interface Ventana {
  ventana: number;
  n: number;
}

// Un DO atiende sus peticiones de una en una y los input gates impiden que otra se cuele
// entre el get y el put del storage: el incremento es atómico (KV no lo es, lección 9).
export class Contador extends DurableObject<Env> {
  async consumir(limite: number, ventanaMs: number, ahoraMs = Date.now()): Promise<{ permitido: boolean; retryAfter: number }> {
    const ventana = Math.floor(ahoraMs / ventanaMs);
    const actual = (await this.ctx.storage.get<Ventana>("v")) ?? { ventana, n: 0 };
    if (actual.ventana !== ventana) {
      actual.ventana = ventana;
      actual.n = 0;
    }
    if (actual.n >= limite) {
      return { permitido: false, retryAfter: Math.ceil(((ventana + 1) * ventanaMs - ahoraMs) / 1000) };
    }
    actual.n++;
    await this.ctx.storage.put("v", actual);
    return { permitido: true, retryAfter: 0 };
  }

  async sumar(n: number): Promise<number> {
    const total = ((await this.ctx.storage.get<number>("t")) ?? 0) + n;
    await this.ctx.storage.put("t", total);
    return total;
  }

  async leer(): Promise<number> {
    return (await this.ctx.storage.get<number>("t")) ?? 0;
  }
}
