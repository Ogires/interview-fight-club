// src/contadores/uso.ts — fachada para los handlers (nombres de instancia en un solo sitio)
import type { Env } from "../env";

export function limitar(env: Env, ruta: string, ip: string, limite: number) {
  return env.CONTADOR.get(env.CONTADOR.idFromName(`rl:${ruta}:${ip}`)).consumir(limite, 60_000, Date.now());
}

// Groq reinicia las cuotas diarias en UTC
export function fechaUtc(ahoraMs = Date.now()): string {
  return new Date(ahoraMs).toISOString().slice(0, 10);
}

function presupuesto(env: Env, modelo: string) {
  return env.CONTADOR.get(env.CONTADOR.idFromName(`tokens:${fechaUtc()}:${modelo}`));
}

export const tokensUsados = (env: Env, modelo: string) => presupuesto(env, modelo).leer();
export const sumarTokens = (env: Env, modelo: string, n: number) => presupuesto(env, modelo).sumar(n);
