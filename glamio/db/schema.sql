-- =========================================
-- GLAMIO – Esquema de base de datos (Fase 1)
-- Ejecutar: psql -U postgres -d glamio -f db/schema.sql
-- =========================================

DROP TABLE IF EXISTS compras_guias, guias, visitas, reportes, materiales_servicio, servicios, resenas_cursos,
  trabajos, respuestas, dudas, progreso_lecciones, inscripciones,
  materiales_curso, lecciones, cursos, academias, usuarias, categorias CASCADE;

-- Categorías: Uñas, Cabello, Cejas (la admin puede añadir más)
CREATE TABLE categorias (
  id      SERIAL PRIMARY KEY,
  nombre  VARCHAR(50) NOT NULL UNIQUE,
  icono   VARCHAR(10)
);

-- Usuarias con perfil
CREATE TABLE usuarias (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL, -- hash bcrypt
  perfil      VARCHAR(20) NOT NULL
              CHECK (perfil IN ('administradora', 'alumna', 'profesional', 'clienta')),
  foto        VARCHAR(255),
  creada_en   TIMESTAMP DEFAULT NOW()
);

-- Academias (fase 1: solo GLAMIO; fase 4: otras academias)
CREATE TABLE academias (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  descripcion  TEXT,
  -- Diseño del certificado (lo cambia la administradora desde el Panel)
  cert_fondo        VARCHAR(255),                 -- imagen de fondo (horizontal)
  cert_firma        VARCHAR(255),                 -- firma escaneada (opcional)
  cert_directora    VARCHAR(100),                 -- nombre bajo la firma
  cert_color_texto  VARCHAR(7) DEFAULT '#3a2f36'  -- color de los textos, p. ej. #3a2f36
);

CREATE TABLE cursos (
  id            SERIAL PRIMARY KEY,
  academia_id   INT NOT NULL REFERENCES academias(id),
  categoria_id  INT NOT NULL REFERENCES categorias(id),
  titulo        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  precio        NUMERIC(8,2) NOT NULL DEFAULT 0, -- 0 = gratis
  imagen        VARCHAR(255),
  creado_en     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lecciones (
  id           SERIAL PRIMARY KEY,
  curso_id     INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  titulo       VARCHAR(150) NOT NULL,
  orden        INT NOT NULL DEFAULT 1,
  video_url    VARCHAR(255), -- enlace YouTube (videos largos)
  video_local  VARCHAR(255), -- archivo subido con multer (videos cortos)
  contenido    TEXT
);

-- Materiales del curso (la calculadora los carga)
CREATE TABLE materiales_curso (
  id        SERIAL PRIMARY KEY,
  curso_id  INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  nombre    VARCHAR(100) NOT NULL,
  cantidad  VARCHAR(50)
);

CREATE TABLE inscripciones (
  id           SERIAL PRIMARY KEY,
  usuaria_id   INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  curso_id     INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  pagado       BOOLEAN DEFAULT FALSE, -- pago simulado
  terminado    BOOLEAN DEFAULT FALSE,
  terminado_en TIMESTAMP, -- fecha real de fin: la que sale en el certificado
  fecha        TIMESTAMP DEFAULT NOW(), -- fecha de inscripción
  UNIQUE (usuaria_id, curso_id)
);

CREATE TABLE progreso_lecciones (
  id           SERIAL PRIMARY KEY,
  usuaria_id   INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  leccion_id   INT NOT NULL REFERENCES lecciones(id) ON DELETE CASCADE,
  completada   BOOLEAN DEFAULT TRUE,
  fecha        TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuaria_id, leccion_id)
);

-- Comunidad: dudas dentro de cada lección
CREATE TABLE dudas (
  id           SERIAL PRIMARY KEY,
  leccion_id   INT NOT NULL REFERENCES lecciones(id) ON DELETE CASCADE,
  usuaria_id   INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  texto        TEXT NOT NULL,
  foto         VARCHAR(255),
  oculta       BOOLEAN DEFAULT FALSE, -- se oculta al reportar
  fecha        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE respuestas (
  id           SERIAL PRIMARY KEY,
  duda_id      INT NOT NULL REFERENCES dudas(id) ON DELETE CASCADE,
  usuaria_id   INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  texto        TEXT NOT NULL,
  destacada    BOOLEAN DEFAULT FALSE, -- solo la admin la marca
  oculta       BOOLEAN DEFAULT FALSE,
  fecha        TIMESTAMP DEFAULT NOW()
);

-- Muro de trabajos
CREATE TABLE trabajos (
  id                 SERIAL PRIMARY KEY,
  usuaria_id         INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  curso_id           INT REFERENCES cursos(id) ON DELETE SET NULL,
  foto               VARCHAR(255) NOT NULL,
  descripcion        TEXT,
  permiso_mi_estilo  BOOLEAN NOT NULL DEFAULT FALSE, -- consentimiento explícito
  oculto             BOOLEAN DEFAULT FALSE,
  fecha              TIMESTAMP DEFAULT NOW()
);

-- Reseñas de cursos (solo con inscripción terminada, una por alumna y curso)
CREATE TABLE resenas_cursos (
  id            SERIAL PRIMARY KEY,
  usuaria_id    INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  curso_id      INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  estrellas     INT NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario    TEXT,
  foto          VARCHAR(255),
  respuesta_admin TEXT, -- las negativas se responden, no se borran
  fecha         TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuaria_id, curso_id)
);

-- Calculadora: servicios de cada usuaria
CREATE TABLE servicios (
  id             SERIAL PRIMARY KEY,
  usuaria_id     INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  categoria_id   INT REFERENCES categorias(id),
  curso_id       INT REFERENCES cursos(id) ON DELETE SET NULL,
  nombre         VARCHAR(100) NOT NULL,
  minutos        INT NOT NULL DEFAULT 60,
  precio_hora    NUMERIC(8,2) NOT NULL DEFAULT 0,
  margen         NUMERIC(5,2) NOT NULL DEFAULT 30, -- %
  precio_sugerido NUMERIC(8,2)
);

CREATE TABLE materiales_servicio (
  id           SERIAL PRIMARY KEY,
  servicio_id  INT NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  nombre       VARCHAR(100) NOT NULL,
  coste        NUMERIC(8,2) NOT NULL DEFAULT 0
);

-- Reportes de contenido (oculta hasta revisión)
CREATE TABLE reportes (
  id           SERIAL PRIMARY KEY,
  usuaria_id   INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  tipo         VARCHAR(20) NOT NULL CHECK (tipo IN ('duda', 'respuesta', 'trabajo')),
  elemento_id  INT NOT NULL,
  motivo       TEXT,
  revisado     BOOLEAN DEFAULT FALSE,
  fecha        TIMESTAMP DEFAULT NOW()
);

-- =========================================
-- Reglas reforzadas en la base de datos
-- (las rutas ya las comprueban; esto es una segunda barrera
--  por si algún día otra ruta o script se olvida de hacerlo)
-- =========================================

-- Regla: una sola respuesta destacada por duda.
-- Índice único PARCIAL: solo mira las filas con destacada = TRUE,
-- así puede haber muchas respuestas normales pero solo una destacada.
CREATE UNIQUE INDEX una_destacada_por_duda
  ON respuestas (duda_id)
  WHERE destacada;

-- Regla: solo se puede reseñar un curso terminado.
-- Un CHECK no puede mirar otra tabla, por eso se usa un trigger:
-- una función que PostgreSQL ejecuta sola antes de cada INSERT.
CREATE OR REPLACE FUNCTION comprobar_resena_terminada() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM inscripciones
    WHERE usuaria_id = NEW.usuaria_id
      AND curso_id = NEW.curso_id
      AND terminado
  ) THEN
    RAISE EXCEPTION 'Solo puedes reseñar cursos que hayas terminado';
  END IF;
  RETURN NEW; -- todo bien: deja guardar la reseña
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resena_solo_si_terminado
  BEFORE INSERT OR UPDATE OF usuaria_id, curso_id ON resenas_cursos
  FOR EACH ROW EXECUTE FUNCTION comprobar_resena_terminada();

-- 🔔 Avisos de la alumna (16/11): ¿ha visto ya la autora de la duda esta respuesta?
-- (En la base que ya existía se añadió con ALTER TABLE ... ADD COLUMN y las antiguas se marcaron como leídas.)
ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS leida BOOLEAN NOT NULL DEFAULT FALSE;

-- ⚑ Reseñas reportables (16/11, RN-21): una reseña reportada se oculta hasta que la directora la revise.
-- (En la base que ya existía se aplicó con estos mismos ALTER TABLE.)
ALTER TABLE resenas_cursos ADD COLUMN IF NOT EXISTS oculta BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reportes DROP CONSTRAINT IF EXISTS reportes_tipo_check;
ALTER TABLE reportes ADD CONSTRAINT reportes_tipo_check CHECK (tipo IN ('duda', 'respuesta', 'trabajo', 'resena'));
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
