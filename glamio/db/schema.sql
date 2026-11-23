-- =========================================
-- GLAMIO – Esquema de base de datos (Fase 1)
-- Ejecutar: psql -U postgres -d glamio -f db/schema.sql
-- =========================================

DROP TABLE IF EXISTS fichas_alumnas, paises, sesiones, tokens_recuperacion, tokens_verificacion, favoritos, compras_guias, guias, visitas, reportes, materiales_servicio, servicios, resenas_cursos,
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
  password    VARCHAR(255) NOT NULL, -- hash Argon2id (nunca la contraseña)
  perfil      VARCHAR(20) NOT NULL
              CHECK (perfil IN ('administradora', 'alumna', 'profesional', 'clienta')),
  foto        VARCHAR(255),
  email_verificado_en TIMESTAMP,     -- NULL = todavía no ha confirmado su email
  intentos_fallidos   INT NOT NULL DEFAULT 0, -- contraseñas mal seguidas (vuelve a 0 al acertar)
  bloqueada_en        TIMESTAMP,     -- NULL = no bloqueada. Al 3.er fallo se bloquea; solo la admin la desbloquea
  creada_en   TIMESTAMP DEFAULT NOW()
);

-- =========================================
-- LOGIN SEGURO: sesiones y tokens
-- Regla de oro: en la BD NUNCA se guarda un token tal cual,
-- solo su huella SHA-256. Si alguien roba la BD, no puede usarlos.
-- =========================================

-- Sesiones abiertas (una por dispositivo/navegador)
CREATE TABLE sesiones (
  id          VARCHAR(64) PRIMARY KEY,  -- SHA-256 del token de la cookie. Nunca el token.
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  creada_en   TIMESTAMP NOT NULL DEFAULT NOW(),
  caduca_en   TIMESTAMP NOT NULL,       -- caducidad deslizante: 30 días, se renueva al volver
  navegador   TEXT                      -- para la pantalla "tus sesiones abiertas"
);
CREATE INDEX sesiones_usuaria_idx ON sesiones (usuaria_id);

-- Enlaces de "he olvidado mi contraseña" (caducan en 30 minutos, un solo uso)
CREATE TABLE tokens_recuperacion (
  id          VARCHAR(64) PRIMARY KEY,  -- SHA-256 del token
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  caduca_en   TIMESTAMP NOT NULL,
  usado_en    TIMESTAMP                 -- NULL = todavía no se ha usado
);

-- Enlaces de verificación de email (caducan en 24 horas; al usarse se borran)
CREATE TABLE tokens_verificacion (
  id          VARCHAR(64) PRIMARY KEY,  -- SHA-256 del token
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  caduca_en   TIMESTAMP NOT NULL
);

-- Academias (fase 1: solo GLAMIO; fase 4: otras academias)
CREATE TABLE academias (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  descripcion  TEXT,
  -- Diseño del certificado (lo cambia la administradora desde el Panel)
  cert_fondo        VARCHAR(255),                 -- imagen de fondo (horizontal)
  cert_firma        VARCHAR(255),                 -- firma escaneada (opcional)
  cert_logo         VARCHAR(255),                 -- logo arriba del certificado (opcional)
  cert_logo_forma   VARCHAR(12) NOT NULL DEFAULT 'desvanecido'  -- cuadrado, redondo o desvanecido
                    CHECK (cert_logo_forma IN ('cuadrado', 'redondo', 'desvanecido')),
  cert_posiciones   JSONB,                        -- dónde va cada dato sobre el fondo (NULL = por defecto)
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
  precio_teoria NUMERIC(8,2) NOT NULL DEFAULT 0, -- precio solo guías (0 = gratis)
  imagen        VARCHAR(255),
  imagen_ajuste VARCHAR(10) NOT NULL DEFAULT 'rellenar'   -- portada: 'rellenar' (recorta) o 'completa' (entera)
                CHECK (imagen_ajuste IN ('rellenar', 'completa')),
  imagen_x      NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (imagen_x BETWEEN 0 AND 100),  -- portada: posición horizontal (%)
  imagen_y      NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (imagen_y BETWEEN 0 AND 100),  -- portada: posición vertical (%)
  creado_en     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lecciones (
  id           SERIAL PRIMARY KEY,
  curso_id     INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  titulo       VARCHAR(150) NOT NULL,
  orden        INT NOT NULL DEFAULT 1,
    tipo         VARCHAR(10) NOT NULL DEFAULT 'video'
               CHECK (tipo IN ('teoria', 'video')), -- guía teórica o video
  gratis       BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = se ve sin pagar (muestra)
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
  nivel        VARCHAR(10) NOT NULL DEFAULT 'completo'
               CHECK (nivel IN ('teoria', 'completo')), -- qué compró: solo guías o todo
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

-- =========================================
-- 18/11 · Fase 2 · Mi Estilo: favoritos de la clienta (se aplica con CREATE: no borra nada)
-- =========================================

-- Un favorito = "esta clienta guardó este trabajo del muro".
-- La clave primaria es la PAREJA (clienta, trabajo): así es imposible guardar el mismo trabajo dos veces.
-- ON DELETE CASCADE: si se borra la clienta o la autora borra su trabajo, el favorito se va solo.
-- (Si la autora solo QUITA el permiso, la fila se queda, pero el servidor no la muestra:
--  así, si vuelve a dar permiso, la clienta lo recupera.)
CREATE TABLE IF NOT EXISTS favoritos (
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  trabajo_id  INT NOT NULL REFERENCES trabajos(id) ON DELETE CASCADE,
  fecha       TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (usuaria_id, trabajo_id)
);

-- Regla también en la base de datos (como la de las reseñas): solo una clienta guarda favoritos,
-- y solo trabajos con permiso de la autora. La ruta ya lo comprueba; esto es la segunda barrera.
CREATE OR REPLACE FUNCTION comprobar_favorito() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarias WHERE id = NEW.usuaria_id AND perfil = 'clienta') THEN
    RAISE EXCEPTION 'Solo las clientas pueden guardar favoritos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM trabajos WHERE id = NEW.trabajo_id AND permiso_mi_estilo = TRUE AND oculto = FALSE) THEN
    RAISE EXCEPTION 'Ese trabajo no se puede guardar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS favorito_solo_clienta ON favoritos;
CREATE TRIGGER favorito_solo_clienta
  BEFORE INSERT ON favoritos
  FOR EACH ROW EXECUTE FUNCTION comprobar_favorito();

-- =========================================
-- 18/11 · Fase 2 · Perfil público: ¿sale este servicio en el perfil de su autora?
-- =========================================
-- Por defecto NO: los servicios de la calculadora son privados hasta que ella lo marque
-- (es su precio de trabajo: decide ella si lo enseña).
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS publico BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================
-- 18/11 · Ficha personal de la alumna (se aplica con CREATE IF NOT EXISTS: no borra nada)
-- =========================================
-- Uso en una base que ya existe:  psql -U postgres -d glamio -f db/migracion-ficha-alumna.sql
-- Se puede ejecutar más de una vez.

-- -----------------------------------------
-- 1. Países y el documento de identidad de cada uno
-- -----------------------------------------
-- ¿Por qué una tabla y no una lista en el código? Así el servidor, la base de datos y la página
-- usan LA MISMA lista, y añadir un país es solo una fila más.
--   patron:  expresión regular que debe cumplir el número YA LIMPIO
--            (sin espacios, puntos ni guiones, y en mayúsculas)
--   ejemplo: lo que se enseña en el formulario para que sepa cómo escribirlo
--   orden:   para que España salga primero y "Otro país" el último
CREATE TABLE IF NOT EXISTS paises (
  codigo     CHAR(2) PRIMARY KEY,           -- código ISO de 2 letras (XX = otro país)
  nombre     VARCHAR(60) NOT NULL UNIQUE,
  documento  VARCHAR(60) NOT NULL,          -- nombre del documento en ese país
  patron     VARCHAR(120) NOT NULL,
  ejemplo    VARCHAR(30) NOT NULL,
  orden      INT NOT NULL DEFAULT 50
);

-- ON CONFLICT ... DO UPDATE: si el país ya existe, se actualiza (por eso se puede ejecutar otra vez)
INSERT INTO paises (codigo, nombre, documento, patron, ejemplo, orden) VALUES
  ('ES', 'España',               'DNI',                               '^[0-9]{8}[A-Z]$',                          '12345678Z',          1),
  ('AR', 'Argentina',            'DNI',                               '^[0-9]{7,8}$',                             '30123456',          10),
  ('BO', 'Bolivia',              'Cédula de identidad',               '^[0-9]{5,10}$',                            '1234567',           10),
  ('BR', 'Brasil',               'CPF',                               '^[0-9]{11}$',                              '12345678909',       10),
  ('CL', 'Chile',                'RUN',                               '^[0-9]{7,8}[0-9K]$',                       '12345678-5',        10),
  ('CO', 'Colombia',             'Cédula de ciudadanía',              '^[0-9]{6,10}$',                            '1020304050',        10),
  ('CU', 'Cuba',                 'Carné de identidad',                '^[0-9]{11}$',                              '85010112345',       10),
  ('EC', 'Ecuador',              'Cédula de identidad',               '^[0-9]{10}$',                              '1712345678',        10),
  ('HN', 'Honduras',             'DNI',                               '^[0-9]{13}$',                              '0801199012345',     10),
  ('MA', 'Marruecos',            'CNIE',                              '^[A-Z]{1,2}[0-9]{5,6}$',                   'AB123456',          10),
  ('MX', 'México',               'CURP',                              '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$', 'GODE850101MDFRRL09', 10),
  ('PY', 'Paraguay',             'Cédula de identidad',               '^[0-9]{5,9}$',                             '4123456',           10),
  ('PE', 'Perú',                 'DNI',                               '^[0-9]{8}$',                               '45678912',          10),
  ('DO', 'República Dominicana', 'Cédula de identidad y electoral',   '^[0-9]{11}$',                              '001-1234567-8',     10),
  ('RO', 'Rumanía',              'CNP',                               '^[1-9][0-9]{12}$',                         '2850101123456',     10),
  ('VE', 'Venezuela',            'Cédula de identidad',               '^[VE]?[0-9]{6,9}$',                        'V-12345678',        10),
  ('XX', 'Otro país',            'Pasaporte',                         '^[A-Z0-9]{5,15}$',                         'AB1234567',         99)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, documento = EXCLUDED.documento,
  patron = EXCLUDED.patron, ejemplo = EXCLUDED.ejemplo, orden = EXCLUDED.orden;

-- -----------------------------------------
-- 2. La ficha: una por alumna
-- -----------------------------------------
-- usuaria_id es la clave primaria: así cada alumna tiene UNA sola ficha.
-- ON DELETE CASCADE: si se borra la cuenta, sus datos personales se borran con ella (RGPD).
-- El tipo de documento NO se guarda aquí: sale del país (paises.documento).
-- UNIQUE (país, número): el mismo documento no puede estar en dos fichas.
CREATE TABLE IF NOT EXISTS fichas_alumnas (
  usuaria_id         INT PRIMARY KEY REFERENCES usuarias(id) ON DELETE CASCADE,
  nombre_completo    VARCHAR(150) NOT NULL,
  pais_nacimiento    CHAR(2) NOT NULL REFERENCES paises(codigo),
  ciudad_nacimiento  VARCHAR(100) NOT NULL,
  numero_documento   VARCHAR(20) NOT NULL,
  usa_nie            BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = nació fuera de España y da su NIE español
  fecha_nacimiento   DATE NOT NULL CHECK (fecha_nacimiento >= DATE '1900-01-01'),
  direccion          VARCHAR(200) NOT NULL,
  telefono           VARCHAR(20) NOT NULL CHECK (telefono ~ '^\+?[0-9]{9,15}$'), -- solo cifras y un + delante
  actualizada_en     TIMESTAMP DEFAULT NOW(),
  UNIQUE (pais_nacimiento, numero_documento)
);

-- NIE (decisión del 18/11): quien nació fuera de España puede dar su NIE en vez del documento de su país.
-- ADD COLUMN IF NOT EXISTS: para las bases donde la tabla ya se creó sin esta columna.
ALTER TABLE fichas_alumnas ADD COLUMN IF NOT EXISTS usa_nie BOOLEAN NOT NULL DEFAULT FALSE;
-- Un NIE es único en España, sea cual sea el país de nacimiento:
-- índice único "parcial" (solo cuenta las filas con usa_nie = TRUE)
CREATE UNIQUE INDEX IF NOT EXISTS un_nie_por_ficha ON fichas_alumnas (numero_documento) WHERE usa_nie;

-- Segunda barrera en la base de datos (la ruta lo comprobará antes):
-- solo una alumna tiene ficha, y el número cumple el formato de su país (o el del NIE).
-- (La letra del DNI/NIE y la edad mínima se comprueban en el servidor.)
CREATE OR REPLACE FUNCTION comprobar_ficha() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarias WHERE id = NEW.usuaria_id AND perfil = 'alumna') THEN
    RAISE EXCEPTION 'Solo las alumnas tienen ficha personal';
  END IF;
  IF NEW.usa_nie THEN
    -- NIE: X, Y o Z + 7 cifras + letra. Las nacidas en España tienen DNI, no NIE.
    IF NEW.pais_nacimiento = 'ES' THEN
      RAISE EXCEPTION 'Si naciste en España, tu documento es el DNI';
    END IF;
    IF NEW.numero_documento !~ '^[XYZ][0-9]{7}[A-Z]$' THEN
      RAISE EXCEPTION 'El NIE no tiene un formato válido';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM paises WHERE codigo = NEW.pais_nacimiento AND NEW.numero_documento ~ patron) THEN
    RAISE EXCEPTION 'El documento no tiene el formato de ese país';
  END IF;
  NEW.actualizada_en := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ficha_solo_alumna ON fichas_alumnas;
CREATE TRIGGER ficha_solo_alumna
  BEFORE INSERT OR UPDATE ON fichas_alumnas
  FOR EACH ROW EXECUTE FUNCTION comprobar_ficha();
