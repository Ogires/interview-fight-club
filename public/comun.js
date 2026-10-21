// public/comun.js — utilidades compartidas por app.js y veredicto.js
// LLM05: todo lo que llega del servidor (y del usuario) se pinta con textContent, nunca con innerHTML

/** Crea un elemento con clase y texto opcionales (siempre vía textContent). */
export function el(tag, clase, texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = String(texto);
  return nodo;
}

/** Vacía un nodo sin innerHTML. */
export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
}

// Ids de villano conocidos: el color de cada esquina va en CSS (atributo data-villano)
const VILLANOS_CON_COLOR = ["senior-amargado", "cto-startup", "arquitecto-enterprise", "reclutador-linkedin"];
export const claseVillano = (id) => (VILLANOS_CON_COLOR.includes(id) ? id : "generico");

/** Nota con coma decimal española: 3.4 → "3,4". */
export const notaEs = (n, decimales = 1) => Number(n).toFixed(decimales).replace(".", ",");

/** Tramo de nota para colorear sellos: mala < 4 ≤ media < 7 ≤ buena. */
export const tramo = (n) => (n >= 7 ? "buena" : n >= 4 ? "media" : "mala");

/** GET/POST JSON. Devuelve { status, datos } y nunca lanza por códigos HTTP. */
export async function api(ruta, cuerpo) {
  const opciones = cuerpo === undefined
    ? { headers: { accept: "application/json" } }
    : { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(cuerpo) };
  const r = await fetch(ruta, opciones);
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    /* cuerpo no JSON (p. ej. 404 de texto) */
  }
  return { status: r.status, datos, cabeceras: r.headers };
}

export const MENSAJE_503 = "RRHH está en una dinámica de grupo. Vuelve en un rato";
