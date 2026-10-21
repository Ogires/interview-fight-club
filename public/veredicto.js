// public/veredicto.js — veredicto público /r/{id} (solo lectura)
// LLM05: alias, comentarios y frase final vienen de la IA o del usuario → textContent siempre
import { el, vaciar, claseVillano, notaEs, tramo, api, MENSAJE_503 } from "./comun.js";

const RE_ID = /^\/r\/([A-Za-z0-9]{12})\/?$/;
const $ = (id) => document.getElementById(id);

const NOMBRES_RESERVA = {
  frontend: "Frontend", backend: "Backend", bbdd: "Bases de datos", devops: "DevOps / Cloud", fundamentos: "Fundamentos",
  junior: "Junior", mid: "Mid", senior: "Senior",
};

function noConsta(mensaje) {
  $("cargando").hidden = true;
  $("veredicto").hidden = true;
  const bloque = $("no-consta");
  if (mensaje) bloque.querySelector("p").textContent = mensaje;
  bloque.hidden = false;
}

function pintar(v, nombres) {
  const art = $("veredicto");
  art.dataset.villano = claseVillano(v.villano?.id ?? idVillanoPorNombre(v.villano?.nombre));
  $("v-emoji").textContent = v.villano?.emoji ?? "🎤";
  $("v-villano").textContent = v.villano?.nombre ?? "El entrevistador";
  $("v-titulo").textContent = v.alias;
  $("v-ficha").textContent = `${nombres[v.stack] ?? v.stack} · ${nombres[v.nivel] ?? v.nivel}`;
  $("v-media").textContent = notaEs(v.media);
  $("v-media-bloque").classList.add(`veredicto__media--${tramo(v.media)}`);
  $("v-media-bloque").setAttribute("aria-label", `Media: ${notaEs(v.media)} sobre 10`);
  $("v-rango").textContent = v.rango;
  $("v-frase").textContent = v.frase_final;
  $("v-firma").textContent = `— ${v.villano?.nombre ?? "El entrevistador"}`;
  if (Number.isFinite(v.creado)) {
    const fecha = new Date(v.creado).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    $("v-fecha").textContent = `Combate disputado el ${fecha}`;
  }

  const lista = $("v-desglose");
  vaciar(lista);
  (v.desglose ?? []).forEach((d, i) => {
    const li = el("li", "asalto");
    const cabeza = el("div", "asalto__cabeza");
    const sello = el("p", `sello sello--${tramo(d.nota)}`);
    sello.append(el("span", "sello__nota", String(d.nota)), el("span", "sello__de", "/10"));
    sello.setAttribute("aria-label", `Nota: ${d.nota} sobre 10`);
    const titulo = el("div", "asalto__titulo");
    titulo.append(el("p", "msg__etiqueta", `Asalto ${i + 1}`), el("h3", "asalto__pregunta", d.pregunta));
    cabeza.append(titulo, sello);
    li.append(cabeza);
    if (d.comentario) li.append(el("p", "asalto__comentario", d.comentario));
    const detalles = el("details", "asalto__esperado");
    detalles.append(el("summary", null, "Lo que esperaba oír"), el("p", null, d.esperado));
    li.append(detalles);
    lista.append(li);
  });

  $("cargando").hidden = true;
  art.hidden = false;
}

// La API pública solo devuelve nombre y emoji del villano: el color se deduce del nombre
function idVillanoPorNombre(nombre = "") {
  const n = nombre.toLowerCase();
  if (n.includes("senior")) return "senior-amargado";
  if (n.includes("cto")) return "cto-startup";
  if (n.includes("arquitecto")) return "arquitecto-enterprise";
  if (n.includes("reclutador")) return "reclutador-linkedin";
  return "generico";
}

async function copiar() {
  const estadoCopia = $("estado-copia");
  try {
    await navigator.clipboard.writeText(location.origin + location.pathname);
    estadoCopia.textContent = "Enlace copiado. Pégalo donde más duela.";
  } catch {
    estadoCopia.textContent = `No he podido copiarlo: ${location.origin + location.pathname}`;
  }
}

async function iniciar() {
  $("btn-copiar").addEventListener("click", copiar);
  const m = RE_ID.exec(location.pathname);
  if (!m) return noConsta();
  let r;
  try {
    r = await api(`/api/veredicto/${m[1]}`);
  } catch {
    r = { status: 0 };
  }
  if (r.status === 404 || r.status === 400) return noConsta();
  if (r.status !== 200 || !r.datos) return noConsta(MENSAJE_503);

  // Nombres bonitos de stack y nivel; si /api/opciones falla, se usan los de reserva
  let nombres = { ...NOMBRES_RESERVA };
  try {
    const o = await api("/api/opciones");
    if (o.status === 200 && o.datos) for (const x of [...o.datos.stacks, ...o.datos.niveles]) nombres[x.id] = x.nombre;
  } catch {
    /* reserva */
  }
  pintar(r.datos, nombres);
}

iniciar();
