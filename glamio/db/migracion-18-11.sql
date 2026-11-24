-- =========================================
-- 18/11 · Fase 2 · Mi Estilo: favoritos de la clienta (se aplica con CREATE: no borra nada)
-- =========================================
-- Uso en una base que ya existe:  psql -U postgres -d glamio -f db/migracion-18-11.sql
SET client_encoding = 'UTF8';

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
