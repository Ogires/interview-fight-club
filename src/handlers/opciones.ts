// src/handlers/opciones.ts — catálogo público (sin prompts: no se exponen)
import { NIVELES, STACKS, VILLANOS } from "../dominio/catalogo";
import { json } from "../http/util";

export function opciones(): Response {
  const villanos = VILLANOS.map(({ id, nombre, emoji, descripcion }) => ({ id, nombre, emoji, descripcion }));
  return json({ stacks: STACKS, niveles: NIVELES, villanos }, 200, { "cache-control": "public, max-age=300" });
}
