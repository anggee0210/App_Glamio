# GLAMIO – Instrucciones del proyecto

App web de belleza con tres categorías: **Uñas, Cabello y Cejas**. Une cursos de una academia, comunidad, calculadora de precios y reseñas verificadas.

**Recorrido:** aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.

## Tecnologías
- HTML, CSS, JS (fetch)
- Node.js + Express
- PostgreSQL (`pg`)
- `express-session` + `bcrypt`
- `multer` (videos largos por YouTube)
- Carpetas: `public/`, `routes/`, `db/`
- Todo en local, pago simulado.

## Perfiles
- **Administradora:** crea cursos, marca destacadas, modera.
- **Alumna**
- **Profesional**
- **Clienta**

## Categorías
Cada curso pertenece a una categoría (Uñas, Cabello o Cejas) y la Academia se puede filtrar por ella.

## Fases
- **Fase 1 (prioridad):** registro por perfiles, panel admin, cursos y lecciones, progreso, certificado, calculadora de precio, dudas con foto, respuesta destacada, muro de trabajos y reseñas de cursos.
- **Fase 2:** Mi Estilo y clientas.
- **Fase 3:** Tienda/Stock.

## Reglas
- Reseña de curso solo si la alumna lo terminó, y una sola por curso.
- Solo la administradora crea cursos y marca destacadas.
- Las reseñas negativas se responden, no se borran.
- Las fotos van a Mi Estilo solo con permiso de su autora.

## Forma de trabajar
- Responde en español y con comentarios en español.
- Código sencillo, nivel de clase.
- Sin servicios externos innecesarios.
