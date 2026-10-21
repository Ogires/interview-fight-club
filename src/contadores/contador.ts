// src/contadores/contador.ts — Durable Object con SQLite (se implementa en la Task 2)
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export class Contador extends DurableObject<Env> {}
