-- =========================================
-- 17/11 · Estadísticas y guías teóricas (se aplica con ALTER/CREATE: no borra nada)
-- =========================================

-- Visitas: una fila por página abierta. Datos mínimos (RGPD): sin IP, solo página, fecha y,
-- si ha entrado, quién. Sirve para las estadísticas de la administradora.
CREATE TABLE IF NOT EXISTS visitas (
  id          SERIAL PRIMARY KEY,
  pagina      VARCHAR(100) NOT NULL,
  usuaria_id  INT REFERENCES usuarias(id) ON DELETE SET NULL,
  fecha       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS visitas_por_fecha ON visitas (fecha);

-- Lo que se pagó al inscribirse (si la administradora cambia el precio, las ventas pasadas no cambian)
ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS importe NUMERIC(8,2) NOT NULL DEFAULT 0;

-- Guías teóricas en PDF que se venden en cada curso (pago simulado)
CREATE TABLE IF NOT EXISTS guias (
  id          SERIAL PRIMARY KEY,
  curso_id    INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  titulo      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  precio      NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  archivo     VARCHAR(255) NOT NULL, -- ruta en privado/guias/ (NO es pública)
  creada_en   TIMESTAMP DEFAULT NOW()
);

-- Quién compró cada guía (una vez por persona) y cuánto pagó
CREATE TABLE IF NOT EXISTS compras_guias (
  id          SERIAL PRIMARY KEY,
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  guia_id     INT NOT NULL REFERENCES guias(id) ON DELETE CASCADE,
  importe     NUMERIC(8,2) NOT NULL DEFAULT 0,
  fecha       TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuaria_id, guia_id)
);
