-- =========================================
-- Logo del certificado (lo sube la administradora desde Panel → Certificado)
-- =========================================
-- Opcional: si está vacío, el certificado sale sin logo.
-- IF NOT EXISTS: se puede ejecutar varias veces sin error.
ALTER TABLE academias ADD COLUMN IF NOT EXISTS cert_logo VARCHAR(255);

-- Forma del logo: cuadrado (tal cual), redondo o desvanecido (redondo con bordes suaves)
ALTER TABLE academias ADD COLUMN IF NOT EXISTS cert_logo_forma VARCHAR(12) NOT NULL DEFAULT 'desvanecido'
  CHECK (cert_logo_forma IN ('cuadrado', 'redondo', 'desvanecido'));

-- Dónde va cada dato (nombre, curso, logo, firma...) encima del fondo subido.
-- La administradora los arrastra en el Panel; vacío (NULL) = posiciones por defecto.
-- JSONB guarda un objeto JSON, p. ej. {"nombre": {"x": 50, "y": 45, "t": 4.2, "ver": true}, ...}
ALTER TABLE academias ADD COLUMN IF NOT EXISTS cert_posiciones JSONB;
