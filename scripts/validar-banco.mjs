// scripts/validar-banco.mjs — validación del banco público de preguntas (A08).
// Compartido por seed.mjs, proponer-preguntas.mjs y tests/banco.test.ts.
// JS plano (sin TS) para que Node lo ejecute sin build; tipos en validar-banco.d.mts.
// Uso CLI: node scripts/validar-banco.mjs [ruta=data/preguntas.json] → exit 1 si hay errores.
// Listas blancas: copia de STACKS y NIVELES de src/dominio/catalogo.ts (un test garantiza que siguen iguales)
export const STACKS = ["frontend", "backend", "bbdd", "devops", "fundamentos"];
export const NIVELES = ["junior", "mid", "senior"];
export const MINIMO_POR_COMBINACION = 8;

// Marcas reservadas del protocolo de nota (⟦NOTA-nonce:N⟧): nunca en el banco
const PROHIBIDO = /[⟦⟧]|NOTA-/;

const esTexto = (v) => typeof v === "string";
const largo = (v, min, max) => esTexto(v) && v.trim().length >= min && v.length <= max;
const estaActiva = (p) => p.activa === undefined || p.activa === true || p.activa === 1;

export function validarBanco(banco, { minimoPorCombinacion = MINIMO_POR_COMBINACION } = {}) {
  if (!Array.isArray(banco)) return ["El banco debe ser un array JSON"];
  const errores = [];
  const ids = new Set();
  const activas = new Map();

  banco.forEach((p, i) => {
    if (!p || typeof p !== "object") {
      errores.push(`#${i + 1}: la entrada no es un objeto`);
      return;
    }
    const id = esTexto(p.id) ? p.id : "";
    const pos = `#${i + 1} (${id || "sin id"})`;

    if (!STACKS.includes(p.stack)) errores.push(`${pos}: stack desconocido "${p.stack}"`);
    if (!NIVELES.includes(p.nivel)) errores.push(`${pos}: nivel desconocido "${p.nivel}"`);
    if (!/^[a-z]+-[a-z]+-\d{3}$/.test(id) || id !== `${p.stack}-${p.nivel}-${id.slice(-3)}`) {
      errores.push(`${pos}: id inválido (formato {stack}-{nivel}-NNN, coherente con stack y nivel)`);
    } else if (ids.has(id)) {
      errores.push(`${pos}: id duplicado`);
    }
    ids.add(id);

    if (!largo(p.texto, 10, 300)) errores.push(`${pos}: texto de 10 a 300 caracteres`);
    if (!largo(p.esperado, 20, 500)) errores.push(`${pos}: esperado de 20 a 500 caracteres`);
    if (p.activa !== undefined && ![true, false, 0, 1].includes(p.activa)) {
      errores.push(`${pos}: activa debe ser booleano o 0/1`);
    }

    const textos = [p.texto, p.esperado];
    if (!Array.isArray(p.rubrica) || p.rubrica.length < 2 || p.rubrica.length > 4) {
      errores.push(`${pos}: la rúbrica debe tener de 2 a 4 conceptos`);
    } else {
      p.rubrica.forEach((c, j) => {
        if (!c || !esTexto(c.concepto) || !c.concepto.trim()) {
          errores.push(`${pos}: concepto ${j + 1} vacío`);
        }
        if (!c || !Array.isArray(c.sinonimos) || !c.sinonimos.every((s) => esTexto(s) && s.trim())) {
          errores.push(`${pos}: concepto ${j + 1} con sinonimos inválidos (array de strings no vacíos)`);
        } else {
          textos.push(c.concepto, ...c.sinonimos);
        }
      });
    }
    if (textos.some((t) => esTexto(t) && PROHIBIDO.test(t))) {
      errores.push(`${pos}: contiene una marca reservada (⟦, ⟧ o NOTA-)`);
    }

    if (STACKS.includes(p.stack) && NIVELES.includes(p.nivel) && estaActiva(p)) {
      const clave = `${p.stack}/${p.nivel}`;
      activas.set(clave, (activas.get(clave) ?? 0) + 1);
    }
  });

  for (const s of STACKS) {
    for (const n of NIVELES) {
      const total = activas.get(`${s}/${n}`) ?? 0;
      if (total < minimoPorCombinacion) {
        errores.push(`${s}/${n}: ${total} preguntas activas (mínimo ${minimoPorCombinacion})`);
      }
    }
  }
  return errores;
}

// CLI. Imports de Node dinámicos: los tests importan este módulo dentro del runtime de
// Workers (sin nodejs_compat), donde no existen ni process ni node:fs.
const esCli = globalThis.process?.argv?.[1] && /validar-banco\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (esCli) {
  const { readFileSync } = await import("node:fs");
  const ruta = process.argv[2] ?? "data/preguntas.json";
  const banco = JSON.parse(readFileSync(ruta, "utf8"));
  const errores = validarBanco(banco);
  if (errores.length) {
    console.error(`❌ ${ruta} tiene ${errores.length} errores:\n  ${errores.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✅ ${ruta}: ${banco.length} preguntas válidas`);
}
