-- =========================================
-- 18/11 · Ficha personal de la alumna (se aplica con CREATE IF NOT EXISTS: no borra nada)
-- =========================================
-- Uso en una base que ya existe:  psql -U postgres -d glamio -f db/migracion-ficha-alumna.sql
-- Se puede ejecutar más de una vez.
SET client_encoding = 'UTF8';

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
