# CLAUDE.md – GLAMIO

Guía para Claude al trabajar en este repositorio. Responde y comenta el código **en español**.

## Qué es GLAMIO
App **web** (no app móvil nativa) de formación en belleza: **Uñas, Cabello y Cejas** (no incluye pestañas).
Une academia de cursos, comunidad, calculadora de precios y reseñas verificadas.

Recorrido clave: **aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.**

Para la entrega de clase, **Uñas** es la categoría principal (2-3 cursos completos) y hay al menos un curso de ejemplo de Cabello o Cejas.

## Stack (solo lo visto en clase)
- **Frontend:** HTML, CSS y JavaScript con `fetch`. Diseño pensado primero para móvil.
- **Backend:** Node.js + Express (API REST).
- **Base de datos:** PostgreSQL con `pg`.
- **Login:** `express-session` + `bcrypt`.
- **Archivos:** `multer` para imágenes y videos propios cortos; videos largos por enlace de YouTube.
- Todo debe funcionar **en local**. El pago es **simulado**.

No añadas frameworks, ORMs ni servicios externos que no estén en esta lista salvo que se pida.

## Estructura de carpetas
```
public/     # HTML, CSS, JS del cliente e imágenes
routes/     # Rutas de Express, una por módulo
db/         # Conexión (pg) y schema.sql
```
El esquema completo de la base de datos está en `db/schema.sql`.

## Perfiles
- **Administradora:** única que crea cursos y lecciones, marca respuesta destacada, responde reseñas y modera.
- **Alumna:** hace cursos, pregunta con foto, usa la calculadora, publica trabajos y reseña cursos terminados.
- **Profesional:** hace cursos, publica trabajos, ayuda en Comunidad, usa la calculadora y recibe reseñas de clientas.
- **Clienta:** ve diseños, guarda favoritos y reseña a su profesional.

## Módulos
- **Academia:** cursos gratis y de pago agrupados por categoría (la admin puede añadir más), lecciones en video, progreso, certificado y lista de materiales por curso. Filtro por categoría en cursos y muro.
- **Calculadora ("Calcular mi precio"):** carga los materiales del curso; la alumna introduce costes, tiempo y margen → precio sugerido. Puede crear servicios propios.
- **Comunidad:** dudas con foto dentro de cada lección, respuesta destacada, muro de trabajos etiquetados por curso, botón de reportar (oculta el contenido hasta revisión).
- **Reseñas:** de cursos solo si está terminado (insignia "Alumna certificada", foto opcional); de profesionales mediante enlace tras la cita. Las negativas se responden, no se borran.
- **Mi Estilo** (fase 2): catálogo tipo swipe con fotos del muro (con permiso de la autora) y favoritos.
- **Tienda/Stock** (fase 3): inventario descontado por servicios, avisos de stock bajo, carrito.

## Fases
1. **Academia (proyecto de clase):** registro por perfiles, panel admin, cursos/lecciones, progreso, certificado, calculadora, dudas, destacada, muro y reseñas.
2. Clientas: Mi Estilo, perfil público, reseñas por enlace.
3. Tienda/Stock.
4. Visión: otras academias publican cursos.

**Prioriza siempre la fase 1** salvo que se pida otra cosa.

## Tablas
- **Fase 1:** `categorias`, `usuarias`, `academias`, `cursos` (con `academia_id` y `categoria_id`), `lecciones`, `materiales_curso`, `inscripciones` (campo `terminado`), `progreso_lecciones`, `dudas`, `respuestas` (campo `destacada`), `trabajos` (permiso Mi Estilo), `resenas_cursos`, `servicios` (con `categoria_id`), `materiales_servicio`, `reportes`.
- **Fase 2:** `favoritos`, `resenas_profesionales`.
- **Fase 3:** `inventario`, `productos`, `pedidos`.

## Reglas obligatorias
- Una reseña de curso solo se permite si la inscripción está **terminada**.
- Una sola reseña por alumna y curso (restricción `UNIQUE`).
- Solo la **administradora** crea cursos y marca respuestas destacadas.
- Las fotos solo aparecen en Mi Estilo con **consentimiento explícito** de la autora.
- Valida estas reglas en el backend (no solo en el frontend).

## Estilo de código
- Código sencillo, de nivel de clase, fácil de explicar en una presentación.
- Nombres de variables, tablas y rutas en español.
- Comentarios breves en español explicando el porqué.
- Consultas SQL con parámetros (`$1, $2…`), nunca concatenando texto.
- Contraseñas siempre con `bcrypt`; nunca en texto plano.

## Modelo de ingresos
Cursos de pago (simulado). Más adelante: tienda y comisión a academias.
