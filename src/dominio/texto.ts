export interface Concepto {
  concepto: string;
  sinonimos: string[];
}

export function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Lookarounds unicode en vez de \b, que casaría "bloque" dentro de "bloqueado" (lección 7)
function menciona(texto: string, termino: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapar(normalizarTexto(termino))}(?![\\p{L}\\p{N}])`, "u").test(texto);
}

export function conceptosMencionados(respuesta: string, rubrica: Concepto[]): number {
  const texto = normalizarTexto(respuesta);
  return rubrica.filter((c) => [c.concepto, ...c.sinonimos].some((t) => menciona(texto, t))).length;
}
