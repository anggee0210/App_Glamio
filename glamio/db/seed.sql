-- =========================================
-- GLAMIO – Datos de ejemplo
-- Ejecutar después de schema.sql
-- La administradora se crea con: node db/crear-admin.js
-- =========================================

INSERT INTO categorias (nombre, icono) VALUES
  ('Uñas', '💅'), ('Cabello', '💇'), ('Cejas', '✨');

INSERT INTO academias (nombre, descripcion) VALUES
  ('Academia GLAMIO', 'Academia oficial de GLAMIO');

-- Uñas: categoría principal (3 cursos)
INSERT INTO cursos (academia_id, categoria_id, titulo, descripcion, precio) VALUES
  (1, 1, 'Manicura básica', 'Aprende limado, cutículas y esmaltado tradicional.', 0),
  (1, 1, 'Esmaltado semipermanente', 'Preparación, aplicación y retirada del semipermanente.', 19.99),
  (1, 1, 'Nail art para principiantes', 'Diseños sencillos con pinceles y puntillas.', 24.99),
-- Curso de ejemplo de otra categoría
  (1, 3, 'Diseño de cejas', 'Medición, depilación con pinza y perfilado.', 14.99);

INSERT INTO lecciones (curso_id, titulo, orden, video_url, contenido) VALUES
  (1, 'Higiene y herramientas', 1, 'https://www.youtube.com/embed/VIDEO_ID', 'Cómo desinfectar tus herramientas.'),
  (1, 'Limado y forma', 2, 'https://www.youtube.com/embed/VIDEO_ID', 'Formas: cuadrada, almendra, ovalada.'),
  (1, 'Esmaltado tradicional', 3, 'https://www.youtube.com/embed/VIDEO_ID', 'Base, color y top coat.'),
  (2, 'Preparación de la uña', 1, 'https://www.youtube.com/embed/VIDEO_ID', 'Deshidratar y matificar.'),
  (2, 'Aplicación y lámpara', 2, 'https://www.youtube.com/embed/VIDEO_ID', 'Capas finas y tiempos de curado.'),
  (3, 'Puntos y líneas', 1, 'https://www.youtube.com/embed/VIDEO_ID', 'Uso de la puntilla.'),
  (4, 'Medir la ceja', 1, 'https://www.youtube.com/embed/VIDEO_ID', 'Los tres puntos clave.');

INSERT INTO materiales_curso (curso_id, nombre, cantidad) VALUES
  (1, 'Lima 180/240', '1'), (1, 'Empujador de cutícula', '1'), (1, 'Esmalte base', '1'),
  (2, 'Base semipermanente', '1'), (2, 'Color semipermanente', '1'), (2, 'Top coat', '1'), (2, 'Lámpara LED/UV', '1'),
  (3, 'Puntilla', '1'), (3, 'Pincel liner', '1'),
  (4, 'Pinza', '1'), (4, 'Lápiz de cejas', '1');
