// public/app.js — el ring: elección, entrevista en streaming y cierre
// Seguridad (diseño §5): sin innerHTML (todo con textContent), sin estilos inline, el servidor manda
import { el, vaciar, claseVillano, notaEs, tramo, api, MENSAJE_503 } from "./comun.js";

const CLAVE = "ifc:sesion";
const TOTAL = 5;
const MAX_CHARS = 600;
const RE_ALIAS = /^[\p{L}\p{N}_-]{3,16}$/u;
const RE_URL_VEREDICTO = /^\/r\/[A-Za-z0-9]{12}$/;
const MENSAJE_CORTE = "Se ha cortado la conexión con el ring. Repite la respuesta";
const MENSAJE_RED = "No llegamos al ring: revisa tu conexión y vuelve a intentarlo";

// Descripciones de sala (solo texto de ambiente; los ids y nombres vienen de /api/opciones)
const DESC_STACK = {
  frontend: "Peso pluma: DOM, CSS, JavaScript y el navegador.",
  backend: "Peso medio: APIs, HTTP, concurrencia y servidores.",
  bbdd: "Peso pesado: índices, transacciones y JOINs que duelen.",
  devops: "Peso crucero: contenedores, pipelines y nubes ajenas.",
  fundamentos: "Peso libre: algoritmos, redes y sistemas operativos.",
};
const DESC_NIVEL = {
  junior: "Primer combate. Te tratarán con… cariño.",
  mid: "Ya has visto producción arder al menos una vez.",
  senior: "Se espera que sepas el porqué, no solo el cómo.",
};
const EMOJI_STACK = { frontend: "🎨", backend: "⚙️", bbdd: "🗄️", devops: "☁️", fundamentos: "🧠" };
const EMOJI_NIVEL = { junior: "🐣", mid: "🔥", senior: "🦉" };

// ---------- localStorage (siempre en try/catch: puede no existir o lanzar) ----------
const leerToken = () => {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
};
const guardarToken = (t) => {
  try {
    localStorage.setItem(CLAVE, t);
  } catch {
    /* modo privado: la sesión no se recuperará al recargar, pero se juega igual */
  }
};
const borrarToken = () => {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const ui = {
  cargando: $("cargando"),
  eleccion: $("pantalla-eleccion"),
  ring: $("pantalla-ring"),
  formEleccion: $("form-eleccion"),
  stack: $("opciones-stack"),
  nivel: $("opciones-nivel"),
  villano: $("opciones-villano"),
  alias: $("alias"),
  btnEntrar: $("btn-entrar"),
  errEleccion: $("error-eleccion"),
  ringEmoji: $("ring-emoji"),
  ringVillano: $("ring-villano"),
  ringAlias: $("ring-alias"),
  ringAsalto: $("ring-asalto"),
  ringCampanas: $("ring-campanas"),
  ringFicha: $("ring-ficha"),
  chat: $("chat"),
  formRespuesta: $("form-respuesta"),
  texto: $("texto-respuesta"),
  contador: $("contador"),
  btnResponder: $("btn-responder"),
  errRespuesta: $("error-respuesta"),
  final: $("final"),
  btnVeredicto: $("btn-veredicto"),
  errFinal: $("error-final"),
  btnOtra: $("btn-otra"),
};

const estado = {
  opciones: null,
  sesion: null,
  villano: null, // { id, nombre, emoji }
  alias: "",
  n: 1, // pregunta que toca responder
  enVuelo: false,
  terminada: false,
};

const reducirMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const verNodo = (nodo) => nodo.scrollIntoView({ block: "nearest", behavior: reducirMovimiento() ? "auto" : "smooth" });

function mostrarPantalla(cual) {
  ui.cargando.hidden = true;
  ui.eleccion.hidden = cual !== "eleccion";
  ui.ring.hidden = cual !== "ring";
}

function mostrarError(nodo, mensaje) {
  nodo.textContent = mensaje;
  nodo.hidden = false;
}
function ocultarError(nodo) {
  nodo.hidden = true;
  nodo.textContent = "";
}

// 429: el mensaje se anuncia una vez; la cuenta atrás es solo visual
let temporizador = null;
function cuentaAtras(nodo, segundos, mensaje, boton, alAcabar) {
  clearInterval(temporizador);
  let s = Math.max(1, Math.ceil(Number(segundos) || 30));
  boton.disabled = true;
  vaciar(nodo);
  nodo.append(el("span", null, `${mensaje}. Vuelve a intentarlo en `));
  const cifra = el("span", "cuenta", `${s} s`);
  nodo.append(cifra, el("span", null, "."));
  nodo.hidden = false;
  temporizador = setInterval(() => {
    s -= 1;
    if (s <= 0) {
      clearInterval(temporizador);
      ocultarError(nodo);
      boton.disabled = false;
      alAcabar?.();
    } else cifra.textContent = `${s} s`;
  }, 1000);
}

// ---------- Pantalla 1: la elección ----------
function tarjeta(grupo, valor, { emoji, nombre, desc, villano }) {
  const label = el("label", "tarjeta");
  if (villano) label.dataset.villano = claseVillano(valor);
  const input = el("input", "sr-only");
  input.type = "radio";
  input.name = grupo;
  input.value = valor;
  input.required = true;
  const cabeza = el("span", "tarjeta__cabeza");
  cabeza.append(el("span", "tarjeta__emoji", emoji ?? ""), el("span", "tarjeta__nombre", nombre));
  label.append(input, cabeza);
  if (desc) label.append(el("span", "tarjeta__desc", desc));
  return label;
}

function pintarOpciones() {
  const o = estado.opciones;
  vaciar(ui.stack);
  vaciar(ui.nivel);
  vaciar(ui.villano);
  for (const s of o.stacks) ui.stack.append(tarjeta("stack", s.id, { emoji: EMOJI_STACK[s.id], nombre: s.nombre, desc: DESC_STACK[s.id] }));
  for (const n of o.niveles) ui.nivel.append(tarjeta("nivel", n.id, { emoji: EMOJI_NIVEL[n.id], nombre: n.nombre, desc: DESC_NIVEL[n.id] }));
  for (const v of o.villanos) ui.villano.append(tarjeta("villano", v.id, { emoji: v.emoji, nombre: v.nombre, desc: v.descripcion, villano: true }));
}

const eleccionCompleta = () => {
  const f = new FormData(ui.formEleccion);
  return f.get("stack") && f.get("nivel") && f.get("villano");
};
const revisarEleccion = () => {
  ui.btnEntrar.disabled = !eleccionCompleta();
};

async function entrar(ev) {
  ev.preventDefault();
  if (!eleccionCompleta() || ui.btnEntrar.disabled) return;
  ocultarError(ui.errEleccion);
  const f = new FormData(ui.formEleccion);
  const alias = String(f.get("alias") ?? "").trim();
  if (alias && !RE_ALIAS.test(alias)) {
    mostrarError(ui.errEleccion, "Ese nombre de guerra no vale: de 3 a 16 letras, números, guion o guion bajo.");
    ui.alias.focus();
    return;
  }
  ui.btnEntrar.disabled = true;
  ui.btnEntrar.textContent = "Sonando la campana…";
  const cuerpo = { stack: f.get("stack"), nivel: f.get("nivel"), villano: f.get("villano") };
  if (alias) cuerpo.alias = alias;
  let r;
  try {
    r = await api("/api/entrevista", cuerpo);
  } catch {
    r = { status: 0, datos: null };
  }
  ui.btnEntrar.textContent = "Entrar al ring";
  if (r.status === 201 && r.datos?.sesion) {
    const d = r.datos;
    guardarToken(d.sesion);
    const v = estado.opciones.villanos.find((x) => x.id === cuerpo.villano);
    iniciarRing({ sesion: d.sesion, villano: v, alias: d.alias, stack: cuerpo.stack, nivel: cuerpo.nivel });
    mensajeVillano(d.saludo);
    mensajePregunta(d.pregunta.n, d.pregunta.texto);
    marcador(d.pregunta.n);
    ui.texto.focus();
    return;
  }
  if (r.status === 429) {
    cuentaAtras(ui.errEleccion, r.datos?.segundos, r.datos?.mensaje ?? "Demasiadas entrevistas", ui.btnEntrar, revisarEleccion);
    return;
  }
  mostrarError(ui.errEleccion, r.status === 400 ? r.datos?.mensaje ?? "El entrevistador no entiende tu letra" : r.status === 0 ? MENSAJE_RED : MENSAJE_503);
  revisarEleccion();
}

// ---------- Pantalla 2: el ring ----------
const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre ?? id;

function iniciarRing({ sesion, villano, alias, stack, nivel }) {
  estado.sesion = sesion;
  estado.villano = villano ?? { id: "generico", nombre: "El Entrevistador", emoji: "🎤" };
  estado.alias = alias;
  estado.terminada = false;
  estado.enVuelo = false;
  ui.ring.dataset.villano = claseVillano(estado.villano.id);
  ui.ringEmoji.textContent = estado.villano.emoji;
  ui.ringVillano.textContent = estado.villano.nombre;
  ui.ringAlias.textContent = alias;
  ui.ringFicha.textContent = `${nombreDe(estado.opciones.stacks, stack)} · ${nombreDe(estado.opciones.niveles, nivel)}`;
  vaciar(ui.chat);
  vaciar(ui.ringCampanas);
  for (let i = 1; i <= TOTAL; i++) ui.ringCampanas.append(el("li", "campana"));
  ui.texto.value = "";
  actualizarContador();
  ui.formRespuesta.hidden = false;
  ui.final.hidden = true;
  ocultarError(ui.errRespuesta);
  ocultarError(ui.errFinal);
  ui.btnOtra.textContent = "Abandonar y empezar otra entrevista";
  bloquear(false);
  mostrarPantalla("ring");
}

function marcador(n, terminada = false) {
  estado.n = n;
  ui.ringAsalto.textContent = terminada ? "Combate terminado" : `Asalto ${n}/${TOTAL}`;
  [...ui.ringCampanas.children].forEach((li, i) => {
    li.classList.toggle("campana--hecha", terminada || i < n - 1);
    li.classList.toggle("campana--actual", !terminada && i === n - 1);
  });
}

function cabeceraVillano() {
  const h = el("header", "msg__quien");
  h.append(el("span", "msg__emoji", estado.villano.emoji), el("span", null, estado.villano.nombre));
  return h;
}

function mensajeVillano(texto) {
  const art = el("article", "msg msg--villano");
  art.append(cabeceraVillano(), el("p", "msg__texto", texto));
  ui.chat.append(art);
  return art;
}

function mensajePregunta(n, texto) {
  const art = el("article", "msg msg--pregunta");
  art.append(el("p", "msg__etiqueta", `Pregunta ${n}/${TOTAL}`), el("p", "msg__texto", texto));
  ui.chat.append(art);
  verNodo(art);
  return art;
}

function mensajeCandidato(texto, archivada = false) {
  const art = el("article", archivada ? "msg msg--candidato msg--archivada" : "msg msg--candidato");
  art.append(el("header", "msg__quien", estado.alias), el("p", "msg__texto", texto));
  ui.chat.append(art);
  return art;
}

function sello(art, nota) {
  const s = el("p", `sello sello--${tramo(nota)}`);
  s.append(el("span", "sello__nota", String(nota)), el("span", "sello__de", "/10"));
  s.setAttribute("aria-label", `Nota: ${nota} sobre 10`);
  art.append(s);
}

function reaccion() {
  const art = el("article", "msg msg--villano msg--reaccion escribiendo");
  const p = el("p", "msg__texto");
  p.setAttribute("aria-live", "polite");
  art.append(cabeceraVillano(), p);
  ui.chat.append(art);
  verNodo(art);
  return { art, p };
}

function bloquear(si) {
  ui.texto.disabled = si;
  ui.btnResponder.disabled = si;
  ui.btnResponder.textContent = si ? "El villano está pensando…" : "Responder";
}

function actualizarContador() {
  const n = ui.texto.value.length;
  ui.contador.textContent = `${n}/${MAX_CHARS}`;
  ui.contador.classList.toggle("contador--limite", n > MAX_CHARS * 0.9);
}

// Lector SSE manual: EventSource solo admite GET y aquí la respuesta va por POST
function parsearEvento(bloque) {
  let evento = "message";
  const datos = [];
  for (const linea of bloque.split("\n")) {
    if (!linea || linea.startsWith(":")) continue;
    const p = linea.indexOf(":");
    const campo = p === -1 ? linea : linea.slice(0, p);
    let valor = p === -1 ? "" : linea.slice(p + 1);
    if (valor.startsWith(" ")) valor = valor.slice(1);
    if (campo === "event") evento = valor;
    else if (campo === "data") datos.push(valor);
  }
  if (!datos.length) return null;
  try {
    return { evento, datos: JSON.parse(datos.join("\n")) };
  } catch {
    return null;
  }
}

async function* leerSse(cuerpo) {
  const lector = cuerpo.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await lector.read();
    if (value) buffer = (buffer + value).replace(/\r\n?/g, "\n");
    let i;
    while ((i = buffer.indexOf("\n\n")) !== -1) {
      const ev = parsearEvento(buffer.slice(0, i));
      buffer = buffer.slice(i + 2);
      if (ev) yield ev;
    }
    if (done) {
      const ev = parsearEvento(buffer);
      if (ev) yield ev;
      return;
    }
  }
}

function turnoCompletado(fin) {
  ui.texto.value = "";
  actualizarContador();
  if (fin.siguiente) {
    mensajePregunta(fin.siguiente.n, fin.siguiente.texto);
    marcador(fin.siguiente.n);
  } else {
    terminar();
  }
}

function terminar() {
  estado.terminada = true;
  marcador(TOTAL, true);
  ui.formRespuesta.hidden = true;
  ui.final.hidden = false;
  ui.btnOtra.textContent = "Empezar otra entrevista";
  verNodo(ui.final);
  ui.btnVeredicto.focus({ preventScroll: true });
}

async function responder(ev) {
  ev.preventDefault();
  if (estado.enVuelo || estado.terminada) return;
  const texto = ui.texto.value.trim();
  ocultarError(ui.errRespuesta);
  if (!texto) {
    mostrarError(ui.errRespuesta, "Escribe algo: el silencio también puntúa, pero mal.");
    ui.texto.focus();
    return;
  }
  estado.enVuelo = true;
  bloquear(true);
  const nCand = mensajeCandidato(texto);
  const { art, p } = reaccion();
  const deshacer = (mensaje) => {
    nCand.remove();
    art.remove();
    if (mensaje) mostrarError(ui.errRespuesta, mensaje);
  };

  let r;
  try {
    r = await fetch("/api/respuesta", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ sesion: estado.sesion, n: estado.n, respuesta: texto }),
    });
  } catch {
    deshacer(MENSAJE_RED);
    estado.enVuelo = false;
    bloquear(false);
    return;
  }

  if (!r.ok || !(r.headers.get("content-type") ?? "").includes("text/event-stream")) {
    let datos = null;
    try {
      datos = await r.json();
    } catch {
      /* sin JSON */
    }
    deshacer();
    estado.enVuelo = false;
    bloquear(false);
    if (r.status === 409) return recargar(); // turno ya respondido o en marcha: el servidor manda
    if (r.status === 404) return sesionPerdida();
    if (r.status === 429) {
      cuentaAtras(ui.errRespuesta, datos?.segundos, datos?.mensaje ?? "Demasiadas respuestas", ui.btnResponder);
      return;
    }
    mostrarError(ui.errRespuesta, r.status === 400 ? datos?.mensaje ?? "El entrevistador no entiende tu letra" : MENSAJE_503);
    return;
  }

  let fin = null;
  let error = null;
  try {
    for await (const { evento, datos } of leerSse(r.body)) {
      if (evento === "texto" && typeof datos?.t === "string") {
        art.classList.remove("escribiendo");
        p.textContent += datos.t;
      } else if (evento === "nota") {
        fin = datos;
      } else if (evento === "error") {
        error = datos?.mensaje ?? MENSAJE_CORTE;
      }
    }
  } catch {
    error = error ?? MENSAJE_CORTE;
  }
  art.classList.remove("escribiendo");
  estado.enVuelo = false;
  if (fin && Number.isFinite(fin.nota)) {
    p.textContent = p.textContent.trim();
    sello(art, fin.nota);
    bloquear(false);
    turnoCompletado(fin);
    if (fin.siguiente) ui.texto.focus({ preventScroll: true });
  } else {
    // El turno no se guardó (o no lo sabemos): se reintenta; si ya estaba guardado, el 409 recargará
    deshacer(error ?? MENSAJE_CORTE);
    bloquear(false);
    ui.texto.focus();
  }
}

// ---------- Recuperación ----------
async function recuperar(token) {
  let r;
  try {
    r = await api(`/api/entrevista?sesion=${encodeURIComponent(token)}`);
  } catch {
    r = { status: 0 };
  }
  if (r.status === 404 || r.status === 400) {
    borrarToken();
    return "perdida";
  }
  if (r.status !== 200 || !r.datos) return "error";
  const d = r.datos;
  const v = estado.opciones.villanos.find((x) => x.id === d.villano);
  iniciarRing({ sesion: token, villano: v, alias: d.alias, stack: d.stack, nivel: d.nivel });
  mensajeVillano("Volvemos a la sala. No creas que me he olvidado de ti.").classList.add("msg--sistema");
  d.turnos.forEach((t, i) => {
    mensajePregunta(i + 1, t.pregunta);
    mensajeCandidato("Respuesta archivada: RRHH no guarda lo que escribes, solo tu nota.", true);
    const art = mensajeVillano(t.comentario ?? "");
    sello(art, t.nota);
  });
  if (d.estado === "terminada" || !d.pregunta_actual) {
    terminar();
  } else {
    mensajePregunta(d.pregunta_actual.n, d.pregunta_actual.texto);
    marcador(d.pregunta_actual.n);
  }
  return "ok";
}

async function recargar() {
  if (!estado.sesion) return;
  const res = await recuperar(estado.sesion);
  if (res === "perdida") sesionPerdida();
  else if (res === "error") mostrarError(ui.errRespuesta, MENSAJE_503);
}

function volverAEleccion(mensaje) {
  clearInterval(temporizador);
  estado.sesion = null;
  ui.formEleccion.reset();
  revisarEleccion();
  ocultarError(ui.errEleccion);
  if (mensaje) mostrarError(ui.errEleccion, mensaje);
  mostrarPantalla("eleccion");
  $("titulo-eleccion").scrollIntoView({ block: "start" });
}

function sesionPerdida() {
  borrarToken();
  volverAEleccion("Esta entrevista no consta en RRHH. Empieza otra.");
}

// ---------- Pantalla 3: veredicto ----------
async function pedirVeredicto() {
  ocultarError(ui.errFinal);
  ui.btnVeredicto.disabled = true;
  ui.btnVeredicto.textContent = "El jurado delibera…";
  let r;
  try {
    r = await api("/api/veredicto", { sesion: estado.sesion });
  } catch {
    r = { status: 0 };
  }
  if (r.status === 200 && RE_URL_VEREDICTO.test(r.datos?.url ?? "")) {
    location.assign(r.datos.url);
    return;
  }
  ui.btnVeredicto.disabled = false;
  ui.btnVeredicto.textContent = "Ver mi veredicto";
  if (r.status === 404) return sesionPerdida();
  if (r.status === 409) return recargar();
  if (r.status === 429) {
    cuentaAtras(ui.errFinal, r.datos?.segundos, r.datos?.mensaje ?? "Demasiadas peticiones", ui.btnVeredicto);
    return;
  }
  mostrarError(ui.errFinal, r.status === 0 ? MENSAJE_RED : MENSAJE_503);
}

// ---------- Arranque ----------
async function iniciar() {
  ui.formEleccion.addEventListener("change", revisarEleccion);
  ui.formEleccion.addEventListener("submit", entrar);
  ui.formRespuesta.addEventListener("submit", responder);
  ui.texto.addEventListener("input", actualizarContador);
  // Ctrl/Cmd + Enter envía la respuesta
  ui.texto.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ui.formRespuesta.requestSubmit();
  });
  ui.btnVeredicto.addEventListener("click", pedirVeredicto);
  ui.btnOtra.addEventListener("click", () => {
    if (estado.enVuelo) return;
    borrarToken();
    volverAEleccion();
  });

  let r;
  try {
    r = await api("/api/opciones");
  } catch {
    r = { status: 0 };
  }
  if (r.status !== 200 || !r.datos?.villanos) {
    ui.cargando.textContent = r.status === 0 ? MENSAJE_RED : MENSAJE_503;
    return;
  }
  estado.opciones = r.datos;
  pintarOpciones();

  const token = leerToken();
  if (token) {
    const res = await recuperar(token);
    if (res === "ok") return;
    volverAEleccion(res === "error" ? MENSAJE_503 : undefined);
    return;
  }
  mostrarPantalla("eleccion");
}

iniciar();
