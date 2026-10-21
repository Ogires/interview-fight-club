const RANGOS: [number, string][] = [
  [9, "Te ofrecen el puesto del entrevistador"],
  [7, "Oferta con stock options sin valor"],
  [5, "Contratado… a prueba"],
  [3, "Becario Eterno"],
  [0, "Te llamaremos (no)"],
];

export function rangoDe(m: number): string {
  return RANGOS.find(([minimo]) => m >= minimo)![1];
}

export function media(notas: number[]): number {
  return Math.round((notas.reduce((a, b) => a + b, 0) / Math.max(1, notas.length)) * 10) / 10;
}
