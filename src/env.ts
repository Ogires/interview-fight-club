import type { Contador } from "./contadores/contador";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  CONTADOR: DurableObjectNamespace<Contador>;
  ASSETS: Fetcher;
  GROQ_API_KEY?: string;
  GROQ_MODEL: string;
  GROQ_MODEL_RESERVA_1: string;
  GROQ_MODEL_RESERVA_2: string;
  CUOTA_TOKENS_DIA: string;
}
