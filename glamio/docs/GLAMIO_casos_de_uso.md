# GLAMIO – Casos de uso

App web de formación en belleza (Uñas, Cabello, Cejas).
Recorrido clave: **aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.**

Este documento cubre la **Fase 1 (Academia – proyecto de clase)**. Al final hay un anexo con los casos de uso de fases posteriores.

---

## 1. Actores

| Actor | Descripción |
|---|---|
| **Visitante** | Persona sin sesión iniciada. Puede ver el catálogo de cursos y registrarse. |
| **Administradora** | Gestiona categorías, cursos y lecciones, marca respuestas destacadas, responde reseñas y modera reportes. |
| **Alumna** | Hace cursos, pregunta dudas con foto, usa la calculadora, publica trabajos y reseña cursos terminados. |
| **Profesional** | Igual que la alumna (cursos, calculadora, muro) y además ayuda respondiendo dudas en la Comunidad. |
| **Clienta** | En fase 1 solo se registra y ve el muro. Su función principal llega en fase 2 (Mi Estilo, reseñas a profesionales). |
| **Sistema** | Calcula progreso, emite certificados y aplica las reglas automáticas. |

> **Usuaria registrada** = Alumna, Profesional o Clienta (cualquier perfil con sesión iniciada que no sea la administradora).

---

## 2. Resumen de casos de uso

| ID | Caso de uso | Actor principal | Módulo |
|---|---|---|---|
| CU-01 | Registrarse | Visitante | Cuenta |
| CU-02 | Iniciar y cerrar sesión | Usuaria registrada / Admin | Cuenta |
| CU-03 | Gestionar categorías | Administradora | Academia |
| CU-04 | Crear y editar curso | Administradora | Academia |
| CU-05 | Gestionar lecciones y materiales | Administradora | Academia |
| CU-06 | Explorar cursos por categoría | Visitante / Usuaria registrada | Academia |
| CU-07 | Inscribirse en un curso | Alumna / Profesional | Academia |
| CU-08 | Ver lección y registrar progreso | Alumna / Profesional | Academia |
| CU-09 | Obtener certificado | Alumna / Profesional | Academia |
| CU-10 | Calcular el precio de un servicio | Alumna / Profesional | Calculadora |
| CU-11 | Crear un servicio propio | Alumna / Profesional | Calculadora |
| CU-12 | Publicar una duda con foto | Alumna / Profesional | Comunidad |
| CU-13 | Responder una duda | Alumna / Profesional / Admin | Comunidad |
| CU-14 | Marcar respuesta destacada | Administradora | Comunidad |
| CU-15 | Publicar un trabajo en el muro | Alumna / Profesional | Comunidad |
| CU-16 | Reportar contenido | Usuaria registrada | Comunidad |
| CU-17 | Moderar reportes | Administradora | Comunidad |
| CU-18 | Reseñar un curso terminado | Alumna / Profesional | Reseñas |
| CU-19 | Responder una reseña | Administradora | Reseñas |

---

## 3. Diagrama general (texto)

```
                 ┌──────────────────────── GLAMIO (Fase 1) ────────────────────────┐
 Visitante ──────┤ CU-01 Registrarse        CU-06 Explorar cursos                   │
                 │                                                                 │
 Alumna /  ──────┤ CU-02 Sesión   CU-07 Inscribirse   CU-08 Ver lección            │
 Profesional     │ CU-09 Certificado   CU-10 Calcular precio   CU-11 Servicio propio│
                 │ CU-12 Duda   CU-13 Responder   CU-15 Publicar trabajo           │
                 │ CU-16 Reportar   CU-18 Reseñar curso                            │
                 │                                                                 │
 Administradora ─┤ CU-03 Categorías   CU-04 Cursos   CU-05 Lecciones               │
                 │ CU-14 Destacada   CU-17 Moderar   CU-19 Responder reseña        │
                 └─────────────────────────────────────────────────────────────────┘

 Relaciones:
  CU-08 ──«include»──> CU-09  (al completar la última lección)
  CU-10 ──«include»──> carga de materiales del curso (CU-05)
  CU-18 ──requiere──> inscripción terminada (CU-08 / CU-09)
  CU-16 ──dispara──> CU-17
```

---

## 4. Detalle de los casos de uso

### CU-01 · Registrarse

| Campo | Contenido |
|---|---|
| **Actor** | Visitante |
| **Objetivo** | Crear una cuenta con un perfil. |
| **Precondición** | No tiene sesión iniciada. |
| **Postcondición** | Se crea un registro en `usuarias` con la contraseña cifrada (**Argon2id**) y se le envía un correo para confirmar su email. |

**Flujo principal**
1. La visitante pulsa «Crear cuenta».
2. El sistema muestra el formulario: nombre, email, contraseña y perfil (Alumna, Profesional o Clienta).
3. La visitante rellena los datos y envía.
4. El sistema valida los campos, cifra la contraseña y guarda la usuaria.
5. El sistema le envía un correo con un enlace (válido 24 h). Al abrirlo, el email queda confirmado, se inicia la sesión y va al inicio según su perfil.

**Flujos alternativos**
- **4a.** El email ya existe → el sistema muestra «Este email ya está registrado».
- **4b.** Faltan campos o la contraseña es demasiado corta → el sistema marca los errores y no guarda.

**Reglas**
- El perfil *Administradora* no se puede elegir en el registro; se crea directamente en la base de datos.

---

### CU-02 · Iniciar y cerrar sesión

| Campo | Contenido |
|---|---|
| **Actor** | Usuaria registrada / Administradora |
| **Precondición** | Tiene cuenta. |
| **Postcondición** | Se crea (o se cierra) la sesión, guardada en la tabla `sesiones` (cookie `glamio_sesion`). |

**Flujo principal**
1. La usuaria introduce email y contraseña.
2. El sistema compara la contraseña con **Argon2id**.
3. Si es correcta, guarda `id` y `perfil` en la sesión y redirige a su panel.
4. Para salir, pulsa «Cerrar sesión» y el sistema destruye la sesión.

**Flujos alternativos**
- **2a.** Credenciales incorrectas → «Email o contraseña incorrectos» (sin indicar cuál falla).

---

### CU-03 · Gestionar categorías

| Campo | Contenido |
|---|---|
| **Actor** | Administradora |
| **Objetivo** | Crear, editar o desactivar categorías (Uñas, Cabello, Cejas y otras nuevas). |
| **Precondición** | Sesión iniciada como administradora. |
| **Postcondición** | La tabla `categorias` queda actualizada y los filtros la muestran. |

**Flujo principal**
1. La administradora entra en *Panel admin → Categorías*.
2. El sistema lista las categorías existentes.
3. La administradora crea una nueva (nombre e icono) o edita una existente.
4. El sistema guarda los cambios.

**Flujos alternativos**
- **3a.** Intenta borrar una categoría con cursos asociados → el sistema no la borra y avisa de que tiene cursos.

---

### CU-04 · Crear y editar curso

| Campo | Contenido |
|---|---|
| **Actor** | Administradora |
| **Precondición** | Sesión de administradora y al menos una categoría creada. |
| **Postcondición** | Curso guardado en `cursos` con `categoria_id` y `academia_id`. |

**Flujo principal**
1. La administradora pulsa «Nuevo curso».
2. Rellena título, descripción, categoría, nivel, imagen de portada, precio (0 = gratis) y estado (borrador / publicado).
3. El sistema sube la imagen con `multer` y guarda el curso.
4. El curso aparece en el catálogo si está publicado.

**Flujos alternativos**
- **2a.** Edita un curso existente → mismo formulario con los datos cargados.
- **3a.** Imagen con formato o tamaño no permitido → mensaje de error.

**Reglas**
- Solo la administradora puede crear o editar cursos (comprobación en la ruta del backend, no solo en el frontend).

---

### CU-05 · Gestionar lecciones y materiales

| Campo | Contenido |
|---|---|
| **Actor** | Administradora |
| **Precondición** | El curso existe. |
| **Postcondición** | Lecciones en `lecciones` y materiales en `materiales_curso`. |

**Flujo principal**
1. Dentro del curso, la administradora pulsa «Añadir lección».
2. Indica título, orden, texto y video: archivo corto (`multer`) o enlace de YouTube.
3. El sistema guarda la lección.
4. En la pestaña «Materiales», añade cada material (nombre, cantidad aproximada por servicio, unidad).
5. El sistema guarda la lista de materiales del curso.

**Flujos alternativos**
- **2a.** El video supera el tamaño permitido → el sistema pide usar enlace de YouTube.
- **4a.** Reordena las lecciones → el sistema actualiza el campo `orden`.

---

### CU-06 · Explorar cursos por categoría

| Campo | Contenido |
|---|---|
| **Actor** | Visitante / Usuaria registrada |
| **Precondición** | Ninguna. |
| **Postcondición** | Ninguna (solo consulta). |

**Flujo principal**
1. La usuaria entra en «Academia».
2. El sistema muestra los cursos publicados con portada, categoría, precio y valoración media.
3. La usuaria filtra por categoría (Uñas, Cabello, Cejas…).
4. Abre un curso y ve descripción, lista de lecciones, materiales y reseñas.

**Flujos alternativos**
- **3a.** No hay cursos en esa categoría → «Aún no hay cursos en esta categoría».

---

### CU-07 · Inscribirse en un curso

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Precondición** | Sesión iniciada y no inscrita ya en ese curso. |
| **Postcondición** | Registro en `inscripciones` con `terminado = false`. |

**Flujo principal**
1. En la ficha del curso, la usuaria pulsa «Inscribirme».
2. Si el curso es gratis, el sistema crea la inscripción directamente.
3. Si es de pago, el sistema muestra una pantalla de **pago simulado** y, al confirmar, crea la inscripción.
4. El sistema redirige a la primera lección.

**Flujos alternativos**
- **1a.** No tiene sesión → el sistema la envía a iniciar sesión (CU-02) y luego vuelve al curso.
- **1b.** Ya está inscrita → el botón muestra «Continuar curso».
- **3a.** Cancela el pago simulado → no se crea la inscripción.

---

### CU-08 · Ver lección y registrar progreso

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Precondición** | Inscrita en el curso. |
| **Postcondición** | Registro en `progreso_lecciones`; porcentaje del curso actualizado. |

**Flujo principal**
1. La usuaria abre una lección.
2. El sistema muestra el video, el texto y las dudas de esa lección.
3. Al terminar, pulsa «Marcar como completada».
4. El sistema guarda el progreso y actualiza la barra de porcentaje.
5. Si era la última lección pendiente, el sistema marca la inscripción como `terminado = true` y lanza CU-09.

**Flujos alternativos**
- **1a.** Intenta abrir una lección sin estar inscrita → el sistema redirige a la ficha del curso.
- **3a.** Desmarca una lección → el progreso baja (el certificado ya emitido se mantiene).

---

### CU-09 · Obtener certificado

| Campo | Contenido |
|---|---|
| **Actor** | Sistema (lo recibe la Alumna / Profesional) |
| **Precondición** | Inscripción con `terminado = true`. |
| **Postcondición** | Certificado disponible en «Mis cursos»; la usuaria pasa a ser «Alumna certificada» de ese curso. |

**Flujo principal**
1. El sistema detecta que se completaron todas las lecciones.
2. Muestra un mensaje de felicitación y el botón «Ver certificado».
3. El certificado (página HTML imprimible) incluye nombre, curso, categoría y fecha.
4. El sistema invita a dejar una reseña (CU-18).

---

### CU-10 · Calcular el precio de un servicio

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Precondición** | Sesión iniciada. |
| **Postcondición** | Precio sugerido mostrado; opcionalmente guardado en `servicios`. |

**Flujo principal**
1. Desde un curso, la usuaria pulsa «Calcular mi precio».
2. El sistema carga los materiales del curso (de `materiales_curso`).
3. La usuaria indica el coste de cada material, la cantidad usada, el tiempo del servicio, su precio por hora y el margen de beneficio (%).
4. El sistema calcula:
   - Coste de materiales = Σ (coste unitario × cantidad usada)
   - Coste de mano de obra = horas × precio por hora
   - **Precio sugerido = (materiales + mano de obra) × (1 + margen / 100)**
5. La usuaria pulsa «Guardar servicio» y el sistema lo guarda con sus materiales en `materiales_servicio`.

**Flujos alternativos**
- **3a.** Deja campos vacíos o negativos → el sistema marca el error y no calcula.
- **5a.** No guarda → el cálculo se pierde al salir.

---

### CU-11 · Crear un servicio propio

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Objetivo** | Calcular el precio de un servicio que no viene de un curso. |
| **Postcondición** | Servicio en `servicios` con `categoria_id`. |

**Flujo principal**
1. En «Calculadora → Mis servicios», pulsa «Nuevo servicio».
2. Escribe nombre y categoría.
3. Añade los materiales a mano.
4. Continúa como en CU-10 desde el paso 3.

**Flujos alternativos**
- **1a.** Edita o borra un servicio guardado.

---

### CU-12 · Publicar una duda con foto

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Precondición** | Inscrita en el curso de la lección. |
| **Postcondición** | Duda guardada en `dudas` vinculada a la lección. |

**Flujo principal**
1. Bajo el video de la lección, pulsa «Tengo una duda».
2. Escribe la pregunta y adjunta una foto opcional de su trabajo.
3. El sistema sube la foto con `multer` y guarda la duda.
4. La duda aparece en la lista de esa lección.

**Flujos alternativos**
- **2a.** Texto vacío → no se publica.
- **3a.** Foto con formato no válido → mensaje de error.

---

### CU-13 · Responder una duda

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional / Administradora |
| **Precondición** | La duda existe y no está oculta. |
| **Postcondición** | Respuesta guardada en `respuestas`. |

**Flujo principal**
1. La usuaria abre una duda.
2. Escribe su respuesta y la envía.
3. El sistema la guarda y la muestra con el perfil de quien responde (p. ej. «Profesional»).

---

### CU-14 · Marcar respuesta destacada

| Campo | Contenido |
|---|---|
| **Actor** | Administradora |
| **Precondición** | La duda tiene al menos una respuesta. |
| **Postcondición** | `respuestas.destacada = true` en una única respuesta por duda. |

**Flujo principal**
1. La administradora revisa una duda.
2. Pulsa «Destacar» en la mejor respuesta.
3. El sistema quita la marca a cualquier otra respuesta de esa duda y marca la elegida.
4. La respuesta destacada se muestra la primera, con una insignia.

**Reglas**
- Solo la administradora puede marcar destacadas.

---

### CU-15 · Publicar un trabajo en el muro

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Precondición** | Sesión iniciada. |
| **Postcondición** | Registro en `trabajos` con curso, categoría y permiso para Mi Estilo. |

**Flujo principal**
1. En «Muro», pulsa «Publicar trabajo».
2. Sube una o varias fotos, escribe una descripción y elige el curso en el que se basa (etiqueta).
3. Marca o no la casilla **«Permito que esta foto aparezca en Mi Estilo»** (desmarcada por defecto).
4. El sistema guarda el trabajo y lo muestra en el muro, filtrable por categoría y curso.

**Reglas**
- Las fotos solo pasan a Mi Estilo (fase 2) con consentimiento explícito.

---

### CU-16 · Reportar contenido

| Campo | Contenido |
|---|---|
| **Actor** | Usuaria registrada |
| **Objetivo** | Avisar de una duda, respuesta, trabajo o reseña inapropiada. |
| **Postcondición** | Registro en `reportes`; el contenido queda **oculto** hasta revisión. |

**Flujo principal**
1. La usuaria pulsa «Reportar» en un contenido.
2. Elige un motivo (spam, ofensivo, no es de belleza, otro) y envía.
3. El sistema guarda el reporte y oculta el contenido.
4. El contenido pasa a la cola de moderación (CU-17).

**Flujos alternativos**
- **2a.** Ya había reportado ese contenido → «Ya enviaste un reporte».

---

### CU-17 · Moderar reportes

| Campo | Contenido |
|---|---|
| **Actor** | Administradora |
| **Precondición** | Hay reportes pendientes. |
| **Postcondición** | Reporte cerrado; contenido restaurado o eliminado. |

**Flujo principal**
1. La administradora entra en *Panel admin → Reportes*.
2. El sistema lista los reportes pendientes con el contenido y el motivo.
3. La administradora elige:
   - **Restaurar** → el contenido vuelve a ser visible.
   - **Eliminar** → el contenido se borra.
4. El sistema marca el reporte como resuelto.

**Reglas**
- Una reseña negativa **no** se elimina por ser negativa; solo si incumple las normas. Si no, se responde (CU-19).

---

### CU-18 · Reseñar un curso terminado

| Campo | Contenido |
|---|---|
| **Actor** | Alumna / Profesional |
| **Precondición** | Inscripción del curso con `terminado = true` y sin reseña previa. |
| **Postcondición** | Registro en `resenas_cursos`; la valoración media del curso se actualiza. |

**Flujo principal**
1. En «Mis cursos» o tras el certificado, pulsa «Dejar reseña».
2. Elige de 1 a 5 estrellas, escribe un comentario y adjunta una foto opcional de su resultado.
3. El sistema comprueba que el curso está terminado y que no hay otra reseña suya.
4. Guarda la reseña con la insignia **«Alumna certificada»**.

**Flujos alternativos**
- **3a.** El curso no está terminado → «Termina el curso para poder reseñarlo».
- **3b.** Ya tiene reseña → el sistema le ofrece editarla.

**Reglas**
- Reseña solo si la inscripción está terminada (comprobado en backend).
- Una reseña por alumna y curso (`UNIQUE (usuaria_id, curso_id)`).

---

### CU-19 · Responder una reseña

| Campo | Contenido |
|---|---|
| **Actor** | Administradora |
| **Precondición** | La reseña existe. |
| **Postcondición** | Respuesta pública guardada en la reseña. |

**Flujo principal**
1. La administradora ve las reseñas de sus cursos.
2. Pulsa «Responder» y escribe la respuesta.
3. El sistema la muestra debajo de la reseña como «Respuesta de la academia».

**Reglas**
- Las reseñas negativas se responden, no se borran.

---

## 5. Matriz actor × caso de uso

| Caso de uso | Visitante | Alumna | Profesional | Clienta | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| CU-01 Registrarse | ✅ | | | | |
| CU-02 Sesión | | ✅ | ✅ | ✅ | ✅ |
| CU-03 Categorías | | | | | ✅ |
| CU-04 Cursos | | | | | ✅ |
| CU-05 Lecciones/materiales | | | | | ✅ |
| CU-06 Explorar cursos | ✅ | ✅ | ✅ | ✅ | ✅ |
| CU-07 Inscribirse | | ✅ | ✅ | | |
| CU-08 Ver lección | | ✅ | ✅ | | |
| CU-09 Certificado | | ✅ | ✅ | | |
| CU-10 Calcular precio | | ✅ | ✅ | | |
| CU-11 Servicio propio | | ✅ | ✅ | | |
| CU-12 Publicar duda | | ✅ | ✅ | | |
| CU-13 Responder duda | | ✅ | ✅ | | ✅ |
| CU-14 Destacar respuesta | | | | | ✅ |
| CU-15 Publicar trabajo | | ✅ | ✅ | | |
| CU-16 Reportar | | ✅ | ✅ | ✅ | |
| CU-17 Moderar | | | | | ✅ |
| CU-18 Reseñar curso | | ✅ | ✅ | | |
| CU-19 Responder reseña | | | | | ✅ |

---

## 6. Anexo – Casos de uso de fases posteriores

**Fase 2 – Clientas**
- **CU-20 Explorar Mi Estilo** (Clienta): desliza fotos del muro con permiso y filtra por categoría.
- **CU-21 Guardar favoritos** (Clienta): guarda diseños en `favoritos` para enseñarlos en su cita.
- **CU-22 Ver perfil público de profesional** (Clienta): trabajos, cursos certificados y reseñas.
- **CU-23 Reseñar a una profesional** (Clienta): mediante un enlace que la profesional envía tras la cita → `resenas_profesionales`.

**Fase 3 – Tienda / Stock**
- **CU-24 Gestionar inventario** (Profesional): registra productos y cantidades.
- **CU-25 Descontar stock por servicio** (Sistema): al registrar un servicio realizado, resta los materiales usados.
- **CU-26 Recibir aviso de stock bajo** (Sistema → Profesional).
- **CU-27 Comprar en la tienda** (Usuaria registrada): carrito y pedido con pago simulado.
