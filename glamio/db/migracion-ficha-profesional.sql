-- =====================================================================
-- Ficha de la PROFESIONAL (25/11) — se puede ejecutar más de una vez, no borra nada.
--
-- La profesional tiene ahora DOS partes:
--  1. Ficha PERSONAL privada (documento, fecha de nacimiento, dirección, teléfono):
--     la MISMA tabla fichas_alumnas y las mismas comprobaciones que la alumna.
--     Solo la ven ella y la administradora. Aquí solo cambia la regla del trigger:
--     antes «solo alumnas», ahora «alumnas y profesionales».
--  2. MI NEGOCIO, pública (tabla nueva fichas_profesionales): lo que una clienta quiere
--     saber para elegirla. La edita ella misma. Sale en su perfil y en el directorio.
-- Las mismas líneas están copiadas en schema.sql.
-- =====================================================================

-- 1. La ficha personal ya no es solo de alumnas
CREATE OR REPLACE FUNCTION comprobar_ficha() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarias WHERE id = NEW.usuaria_id AND perfil IN ('alumna', 'profesional')) THEN
    RAISE EXCEPTION 'Solo las alumnas y las profesionales tienen ficha personal';
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

-- 2. Mi negocio (pública)
CREATE TABLE IF NOT EXISTS fichas_profesionales (
  usuaria_id        INT PRIMARY KEY REFERENCES usuarias(id) ON DELETE CASCADE,
  nombre_negocio    VARCHAR(100),                       -- salón o marca (opcional: puede trabajar por su cuenta)
  ciudad            VARCHAR(80) NOT NULL,               -- dónde la puede encontrar una clienta
  zona              VARCHAR(80),                        -- barrio o zona (nunca la dirección exacta)
  especialidades    INT[] NOT NULL DEFAULT '{}',        -- ids de categorias (Uñas, Cabello, Cejas)
  anios_experiencia INT CHECK (anios_experiencia BETWEEN 0 AND 60),
  a_domicilio       BOOLEAN NOT NULL DEFAULT FALSE,     -- ¿va a casa de la clienta?
  instagram         VARCHAR(60),                        -- solo el usuario, sin @
  sobre_mi          VARCHAR(400),                       -- presentación corta
  actualizada_en    TIMESTAMP DEFAULT NOW()
);

-- Solo una profesional tiene «Mi negocio» y debe tener al menos una especialidad
CREATE OR REPLACE FUNCTION comprobar_negocio() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarias WHERE id = NEW.usuaria_id AND perfil = 'profesional') THEN
    RAISE EXCEPTION 'Solo las profesionales tienen «Mi negocio»';
  END IF;
  IF cardinality(NEW.especialidades) = 0 THEN
    RAISE EXCEPTION 'Elige al menos una especialidad';
  END IF;
  NEW.actualizada_en := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS negocio_solo_profesional ON fichas_profesionales;
CREATE TRIGGER negocio_solo_profesional
  BEFORE INSERT OR UPDATE ON fichas_profesionales
  FOR EACH ROW EXECUTE FUNCTION comprobar_negocio();
