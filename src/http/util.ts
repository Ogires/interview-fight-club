// src/http/util.ts — utilidades HTTP compartidas por los handlers
export function json(datos: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(datos, { status, headers: { "cache-control": "no-store", ...extra } });
}

const MAX_CUERPO = 2_048;

// A05: JSON con tamaño máximo y forma (objeto plano) validada a mano
export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > MAX_CUERPO) return null; // ni se lee un cuerpo que ya se anuncia enorme
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return null;
  try {
    const v = JSON.parse(texto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export const esUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export const ip = (request: Request) => request.headers.get("cf-connecting-ip") ?? "0.0.0.0";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// 12 caracteres de 57 símbolos ≈ 70 bits: no se adivina, y es corto para LinkedIn
// (el sesgo del módulo es despreciable para un id de solo lectura)
export function idPublico(): string {
  return [...crypto.getRandomValues(new Uint8Array(12))].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}

export function aliasPorDefecto(): string {
  return `Candidato-${idPublico().slice(0, 4).toUpperCase()}`;
}

export function validarAlias(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const alias = s.trim();
  return /^[\p{L}\p{N}_-]{3,16}$/u.test(alias) ? alias : null;
}

export const recortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s).trim();
