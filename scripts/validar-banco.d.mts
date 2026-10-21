// Tipos de validar-banco.mjs para los tests (tsc no tipa .mjs sin allowJs)
export interface PreguntaBanco {
  id: string;
  stack: string;
  nivel: string;
  texto: string;
  rubrica: { concepto: string; sinonimos: string[] }[];
  esperado: string;
  activa?: boolean | 0 | 1;
}
export const STACKS: string[];
export const NIVELES: string[];
export const MINIMO_POR_COMBINACION: number;
export function validarBanco(banco: unknown, opciones?: { minimoPorCombinacion?: number }): string[];
