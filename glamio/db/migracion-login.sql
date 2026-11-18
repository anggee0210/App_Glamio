-- =========================================
-- 18/11 · Login seguro: sesiones propias, recuperar contraseña y verificar email
-- (se aplica con ALTER/CREATE IF NOT EXISTS: NO borra nada, se puede ejecutar varias veces)
-- =========================================
-- Uso en una base que ya existe:  psql -U postgres -d glamio -f db/migracion-login.sql
SET client_encoding = 'UTF8';

-- Cuándo confirmó su email (NULL = todavía no)
ALTER TABLE usuarias ADD COLUMN IF NOT EXISTS email_verificado_en TIMESTAMP;

-- Bloqueo de cuentas: al 3.er intento fallido de contraseña la cuenta se bloquea
-- y solo la administradora puede desbloquearla.
ALTER TABLE usuarias ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE usuarias ADD COLUMN IF NOT EXISTS bloqueada_en TIMESTAMP;   -- NULL = no bloqueada

-- Las cuentas que YA existían antes de este cambio se dan por verificadas:
-- se crearon cuando no había verificación y no queremos dejarlas fuera.
-- (Las cuentas nuevas sí tendrán que confirmar su email.)
-- La condición "aún no existe la tabla sesiones" hace que esto solo pase la PRIMERA vez
-- que se ejecuta la migración (si se repite, no verifica a nadie por error).
UPDATE usuarias SET email_verificado_en = COALESCE(creada_en, NOW())
WHERE email_verificado_en IS NULL
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sesiones');

-- Emails sin espacios y en minúsculas (así se guardan ahora).
-- Solo si no choca con otra cuenta que ya tenga ese email en minúsculas.
UPDATE usuarias u SET email = LOWER(TRIM(u.email))
WHERE u.email <> LOWER(TRIM(u.email))
  AND NOT EXISTS (SELECT 1 FROM usuarias o WHERE o.id <> u.id AND o.email = LOWER(TRIM(u.email)));

-- Sesiones abiertas (una por dispositivo). id = SHA-256 del token de la cookie, nunca el token.
-- (OJO: esta tabla tiene que crearse DESPUÉS del UPDATE de arriba, que mira si ya existe.)
CREATE TABLE IF NOT EXISTS sesiones (
  id          VARCHAR(64) PRIMARY KEY,
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  creada_en   TIMESTAMP NOT NULL DEFAULT NOW(),
  caduca_en   TIMESTAMP NOT NULL,
  navegador   TEXT
);
CREATE INDEX IF NOT EXISTS sesiones_usuaria_idx ON sesiones (usuaria_id);

-- Enlaces de "he olvidado mi contraseña" (30 minutos, un solo uso)
CREATE TABLE IF NOT EXISTS tokens_recuperacion (
  id          VARCHAR(64) PRIMARY KEY,
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  caduca_en   TIMESTAMP NOT NULL,
  usado_en    TIMESTAMP
);

-- Enlaces de verificación de email (24 horas; al usarse se borran)
CREATE TABLE IF NOT EXISTS tokens_verificacion (
  id          VARCHAR(64) PRIMARY KEY,
  usuaria_id  INT NOT NULL REFERENCES usuarias(id) ON DELETE CASCADE,
  caduca_en   TIMESTAMP NOT NULL
);

-- Las contraseñas antiguas (bcrypt) NO hace falta tocarlas: cada usuaria pasa
-- a Argon2id sola la próxima vez que entra (ver middleware/contrasenas.js).
