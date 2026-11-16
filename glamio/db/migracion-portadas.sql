-- =========================================
-- Ajuste de la foto de portada de cada curso (lo elige la administradora en el Panel)
-- =========================================
-- 'rellenar' = la foto ocupa todo el cuadro (se recortan un poco los bordes). Es lo de siempre.
-- 'completa' = la foto se ve entera dentro del cuadro; lo que sobra se rellena con la misma foto difuminada.
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS imagen_ajuste VARCHAR(10) NOT NULL DEFAULT 'rellenar'
  CHECK (imagen_ajuste IN ('rellenar', 'completa'));

-- Posición de la foto al «Rellenar»: qué parte queda a la vista (0-100 %; 50 = centrada).
-- La administradora la elige arrastrando la foto en la vista previa del Panel.
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS imagen_x NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (imagen_x BETWEEN 0 AND 100);
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS imagen_y NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (imagen_y BETWEEN 0 AND 100);
