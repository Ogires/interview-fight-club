// scripts/proponer-preguntas.mjs — propone preguntas nuevas con Groq para REVISIÓN HUMANA.
// No toca data/preguntas.json ni la D1: escribe data/propuestas-{stack}-{nivel}.json (gitignored).
// Uso: npm run proponer -- <stack> <nivel> [n=10]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { NIVELES, STACKS, validarBanco } from "./validar-banco.mjs";

// GROQ_URL sobreescribible solo para probar el script contra un mock local
const GROQ_URL = process.env.GROQ_URL ?? "https://api.groq.com/openai/v1/chat/completions";
const RUTA = "data/preguntas.json";

const [stack, nivel, nArg] = process.argv.slice(2);
const n = Math.max(1, Math.min(20, Number.parseInt(nArg ?? "10", 10) || 10));

function leerKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (!existsSync(".dev.vars")) return undefined;
  for (const linea of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*GROQ_API_KEY\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
}

const normalizar = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

async function main() {
  if (!STACKS.includes(stack) || !NIVELES.includes(nivel)) {
    console.error(`Uso: npm run proponer -- <${STACKS.join("|")}> <${NIVELES.join("|")}> [n=10]`);
    return 1;
  }
  const apiKey = leerKey();
  if (!apiKey) {
    console.error("❌ Falta GROQ_API_KEY (variable de entorno o línea en .dev.vars)");
    return 1;
  }
  const model = readFileSync("wrangler.jsonc", "utf8").match(/"GROQ_MODEL":\s*"([^"]+)"/)?.[1];
  if (!model) {
    console.error("❌ No encuentro GROQ_MODEL en wrangler.jsonc");
    return 1;
  }

  const banco = JSON.parse(readFileSync(RUTA, "utf8"));
  const deLaCombinacion = banco.filter((p) => p.stack === stack && p.nivel === nivel);
  const textosVistos = new Set(banco.map((p) => normalizar(p.texto)));
  let siguiente = deLaCombinacion.reduce((m, p) => Math.max(m, Number(p.id.slice(-3))), 0) + 1;

  const SYSTEM = `Eres un entrevistador técnico senior que redacta el banco de preguntas de Interview Fight Club.
Reglas de cada pregunta:
- En español de España correcto, conceptual, respondible en 600 caracteres, con una respuesta canónica clara.
- Nada de escribir código largo, nada de opinión ("¿cuál es tu framework favorito?") ni preguntas trampa.
- Técnicamente exacta y sin ambigüedad. Stack: ${stack}. Nivel: ${nivel}.
- "texto": la pregunta (10-300 caracteres).
- "rubrica": de 2 a 4 conceptos clave {"concepto", "sinonimos"}; los sinonimos son las palabras o frases cortas
  que un candidato escribiría DE VERDAD al mencionar ese concepto, en español y en inglés técnico, incluidas
  formas en plural y abreviaturas habituales (se buscan como palabra completa, sin distinguir tildes ni mayúsculas).
- "esperado": la respuesta canónica breve (20-500 caracteres).
Responde SOLO con un objeto JSON {"preguntas": [{"texto", "rubrica", "esperado"}]}.`;

  const USER = `Propón ${n} preguntas nuevas. Ejemplos del formato:
${JSON.stringify(deLaCombinacion.slice(0, 2).map(({ texto, rubrica, esperado }) => ({ texto, rubrica, esperado })), null, 1)}
NO repitas ninguna de estas preguntas ya existentes:
${deLaCombinacion.map((p) => `- ${p.texto}`).join("\n")}`;

  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: USER },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 6000,
      reasoning_effort: "low",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) {
    console.error(`❌ Groq respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return 1;
  }
  const contenido = (await r.json()).choices?.[0]?.message?.content ?? "";
  let crudas;
  try {
    crudas = JSON.parse(contenido)?.preguntas;
  } catch {
    crudas = null;
  }
  if (!Array.isArray(crudas)) {
    console.error("❌ La respuesta no contiene {\"preguntas\": [...]} válido");
    return 1;
  }

  const validas = [];
  const descartes = [];
  for (const c of crudas) {
    const p = {
      id: `${stack}-${nivel}-${String(siguiente).padStart(3, "0")}`,
      stack,
      nivel,
      texto: String(c?.texto ?? "").trim(),
      rubrica: Array.isArray(c?.rubrica)
        ? c.rubrica.map((x) => ({
            concepto: String(x?.concepto ?? "").trim(),
            sinonimos: Array.isArray(x?.sinonimos) ? x.sinonimos.map((s) => String(s).trim()).filter(Boolean) : [],
          }))
        : [],
      esperado: String(c?.esperado ?? "").trim(),
    };
    // Sin el mínimo por combinación: aquí se valida cada propuesta suelta
    const errores = validarBanco([p], { minimoPorCombinacion: 0 }).map((e) => e.replace(/^#1 \([^)]*\): /, ""));
    if (textosVistos.has(normalizar(p.texto))) errores.push("repetida (ya está en el banco o en este lote)");
    if (errores.length) {
      descartes.push(`${p.texto.slice(0, 60) || "?"}: ${errores.join("; ")}`);
      continue;
    }
    textosVistos.add(normalizar(p.texto));
    validas.push(p);
    siguiente++;
  }

  const salida = `data/propuestas-${stack}-${nivel}.json`;
  writeFileSync(salida, JSON.stringify(validas, null, 2) + "\n", "utf8");
  console.log(`✅ ${validas.length} válidas, ${descartes.length} descartadas → ${salida}`);
  for (const d of descartes) console.log(`   ✗ ${d}`);
  console.log("Revísalas a mano (sobre todo las rúbricas), copia las buenas a data/preguntas.json y ejecuta npm run validar");
  return 0;
}

process.exitCode = await main();
