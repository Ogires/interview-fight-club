CREATE TABLE preguntas (
  id        TEXT PRIMARY KEY,            -- 'sql-mid-007'
  stack     TEXT NOT NULL,               -- 'frontend'|'backend'|'bbdd'|'devops'|'fundamentos'
  nivel     TEXT NOT NULL,               -- 'junior'|'mid'|'senior'
  texto     TEXT NOT NULL,
  rubrica   TEXT NOT NULL,               -- JSON [{ "concepto": "índice", "sinonimos": ["index","b-tree"] }]
  esperado  TEXT NOT NULL,               -- "lo que esperaba oír" (desglose del veredicto)
  activa    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_preguntas_filtro ON preguntas(stack, nivel, activa);

CREATE TABLE sesiones (
  id           TEXT PRIMARY KEY,         -- token secreto (UUID)
  alias        TEXT NOT NULL,
  stack        TEXT NOT NULL,
  nivel        TEXT NOT NULL,
  villano      TEXT NOT NULL,
  preguntas    TEXT NOT NULL,            -- JSON ["sql-mid-007", ...] (5 ids)
  n_pregunta   INTEGER NOT NULL DEFAULT 0,  -- respondidas (0..5)
  notas        TEXT NOT NULL DEFAULT '[]',  -- JSON [7, 3, ...]
  comentarios  TEXT NOT NULL DEFAULT '[]',  -- JSON (recortados a 400)
  estado       TEXT NOT NULL DEFAULT 'en_curso',  -- 'en_curso'|'terminada'
  reserva_ms   INTEGER,                  -- turno en vuelo (bloqueo optimista)
  creada_ms    INTEGER NOT NULL,
  publico_id   TEXT UNIQUE               -- se asigna al crear el veredicto
);

CREATE TABLE veredictos (
  publico_id   TEXT PRIMARY KEY,         -- aleatorio, distinto del token
  alias        TEXT NOT NULL,
  stack        TEXT NOT NULL,
  nivel        TEXT NOT NULL,
  villano      TEXT NOT NULL,
  media        REAL NOT NULL,
  rango        TEXT NOT NULL,
  frase_final  TEXT NOT NULL,
  desglose     TEXT NOT NULL,            -- JSON [{pregunta, nota, comentario, esperado}]
  creado_ms    INTEGER NOT NULL
);
