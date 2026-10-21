import villanos from "../../data/villanos.json";

export interface Villano {
  id: string;
  nombre: string;
  emoji: string;
  descripcion: string;
  prompt_persona: string;
  saludo: string;
  frases_reserva: { buena: string[]; media: string[]; mala: string[] };
  cierres_reserva: string[];
}

export const VILLANOS: Villano[] = villanos;

export const STACKS = [
  { id: "frontend", nombre: "Frontend" },
  { id: "backend", nombre: "Backend" },
  { id: "bbdd", nombre: "Bases de datos" },
  { id: "devops", nombre: "DevOps / Cloud" },
  { id: "fundamentos", nombre: "Fundamentos" },
] as const;

export const NIVELES = [
  { id: "junior", nombre: "Junior" },
  { id: "mid", nombre: "Mid" },
  { id: "senior", nombre: "Senior" },
] as const;

export const villanoPorId = (id: unknown) => VILLANOS.find((v) => v.id === id);
export const esStack = (s: unknown): s is string => STACKS.some((x) => x.id === s);
export const esNivel = (s: unknown): s is string => NIVELES.some((x) => x.id === s);

export function aleatorio<T>(lista: T[]): T {
  const i = crypto.getRandomValues(new Uint32Array(1))[0] % lista.length;
  return lista[i];
}

export function fraseReserva(v: Villano, nota: number): string {
  return aleatorio(nota >= 7 ? v.frases_reserva.buena : nota >= 4 ? v.frases_reserva.media : v.frases_reserva.mala);
}
