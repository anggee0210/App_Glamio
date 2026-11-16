# GLAMIO 

App web de formación en belleza (uñas, cabello y cejas): **academia de cursos**, **comunidad**, **calculadora de precios**, **reseñas verificadas** y **guías teóricas**.

**Recorrido clave:** aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.

> Proyecto final de clase · Fase 1 (Academia) · Entrega: 25/11/2026
> GLAMIO es la app; los cursos los publica la **administradora** de la academia.

---

## Perfiles

| Perfil | Qué puede hacer |
|---|---|
| **Administradora** | Crea, edita y borra cursos, lecciones y materiales · sube guías teóricas en PDF · diseña el certificado · responde dudas y marca la ⭐ destacada · responde reseñas · revisa los reportes · ve las **estadísticas** |
| **Alumna** | Se inscribe (gratis o con pago simulado) · ve lecciones y marca su progreso · certificado · compra guías · pregunta con foto · calculadora · publica sus trabajos · reseña cursos terminados · tiene **perfil público** (fase 2) |
| **Profesional** | Lo mismo que la alumna · su insignia es «Profesional certificada» |
| **Clienta** | El **muro** en lectura (trabajos con permiso de su autora) y **💜 Mi Estilo**: guarda con ♡ los que le gustan (fase 2) |

La cuenta de la administradora no se puede crear desde la web: se crea con `db/crear-admin.js`.

---

## Qué hace (fase 1)

- **Academia**
  - Página **Cursos** con filtros por categoría; cursos gratis o de pago, con **pago simulado** (no se piden datos de tarjeta).
  - Lecciones con vídeo de YouTube o vídeo corto propio (máximo 50 MB) y botón «Empezar / Continuar curso».
  - Progreso por lección, **certificado** con diseño propio y página «Mis certificados».
  - **📖 Guías teóricas en PDF** en cada curso: se compran con pago simulado y **solo las descarga quien las compró**.
- **Calculadora «Calcular mi precio»**
  - Desde un curso carga sus materiales. La alumna pone el coste, los minutos, el valor de su hora y el margen.
  - Fórmula: `(materiales + minutos/60 × precio_hora) × (1 + margen/100)`.
  - Los servicios se guardan en «Mis servicios» y se pueden borrar.
- **Comunidad** (pestañas 📷 Trabajos y ❓ Dudas)
  - **Dudas**: con foto en cada lección. Tienen respuestas y una **respuesta destacada** que solo marca la administradora.
  - **Trabajos**: muro etiquetado por curso. La autora decide si las clientas ven su foto (👁/🔒) y puede borrarla.
- **Reseñas**
  - Solo de cursos terminados y una por persona, de 1 a 5 ⭐, con foto opcional.
  - La administradora las responde. La autora puede borrarla, pero no editarla.
- **🔔 Notificaciones** (una sola opción en el menú, con número rojo)
  - Administradora: dudas sin responder y reseñas de 1 a 3 ⭐ sin respuesta.
  - Alumna y profesional: respuestas nuevas a sus dudas.
- **⚑ Reportes**: lo reportado se oculta al momento; la administradora decide en su página si vuelve a publicarse.
- **Panel de la administradora** con **menú lateral**:
  - **🏠 Panel principal** con **estadísticas**: cursos, lecciones, alumnas, valoración media, **visitas a la app** y **cursos vendidos por mes** (gráficas y tabla), y los cursos más vendidos;
  - Mis cursos (editar y **borrar**, con doble confirmación si hay inscritas), Nuevo curso, Nueva lección, Materiales, Certificado, Guías teóricas, Reportes y Notificaciones.
- **Diseño**: morado y lila, logo de la G dorada, pantalla completa en el PC (letra más grande en monitores grandes) y menú ☰ en el móvil.

## Fase 2 empezada: 💜 Mi Estilo (clienta)

- **Catálogo** de una foto grande: se pasa con ‹ ›, con las flechas del teclado o deslizando el dedo en el móvil. Muestra la autora y el curso.
- **♡ Guardar** en el catálogo y en el muro. Debajo, **Mis favoritos** en cuadrícula; el ♥ lo quita.
- Solo salen trabajos **con permiso de la autora y sin reportar**. Si la autora quita el permiso, desaparece también de los favoritos (y vuelve si lo da otra vez); si lo borra, el favorito se borra solo.
- Los favoritos son **privados**: nadie más los ve, tampoco la autora.

## Fase 2 empezada: 👤 Perfil público (alumna y profesional)

- Página `perfil.html?id=N`, que puede ver **cualquiera** (también sin cuenta). Se llega pulsando el nombre de la autora en el muro o en Mi Estilo, o desde «👤 Mi perfil público» en el menú del círculo.
- Muestra nombre, insignia («Alumna/Profesional certificada» solo si ha terminado algún curso), cursos terminados, trabajos y servicios. **Nunca el email.**
- Los trabajos siguen la **misma regla que el muro**: a la clienta y a quien no tiene cuenta solo le salen los que tienen permiso; los reportados no salen.
- Servicios: en **Calculadora → Mis servicios**, la casilla **«👁 Mostrar en mi perfil»** (por defecto, desmarcada). Sale el nombre, los minutos y el precio, sin el desglose de costes.

---

## Stack

- **Frontend:** HTML, CSS y JavaScript (fetch), sin frameworks · diseño para el móvil y a pantalla completa en el PC
- **Backend:** Node.js + Express (API REST)
- **Base de datos:** PostgreSQL con `pg` (consultas parametrizadas `$1, $2`)
- **Login:** `express-session` + `bcrypt`
- **Archivos:** `multer` (imágenes, vídeos cortos y PDF de las guías; los vídeos largos, por YouTube)
- Todo funciona **en local**: sin servicios externos (las tipografías se cargan de Google Fonts y, sin internet, se usan las del sistema).

---

## Estructura

```
glamio/
├── server.js              # Servidor Express, contador de visitas, rutas y manejo de errores
├── package.json
├── .env.example           # Copiar como .env
├── db/
│   ├── pool.js            # Conexión a PostgreSQL
│   ├── schema.sql         # Tablas, índices y trigger (¡borra todo! ver abajo)
│   ├── migracion-17-11.sql # Estadísticas y guías para una base que ya existe (no borra nada)
│   ├── migracion-18-11.sql # Fase 2: tabla favoritos y su trigger + servicios.publico (no borra nada)
│   ├── seed.sql           # Categorías, academia y cursos de ejemplo
│   ├── crear-admin.js     # Crea la cuenta de la administradora
│   └── cambiar-contrasena.js # Cambia la contraseña de una cuenta (si se olvida)
├── middleware/
│   ├── auth.js            # requiereLogin / requiereAdmin / requierePerfil
│   ├── permisos.js        # esId() y puedeEntrarEnLeccion() (RN-14)
│   └── subidas.js         # multer: tipos y tamaño, rechazar() y borrarArchivo()
├── routes/
│   ├── auth.js            # Registro, login, logout, /yo
│   ├── categorias.js      # Uñas, Cabello, Cejas…
│   ├── cursos.js          # Cursos (crear, editar, borrar), materiales, inscripción, progreso, certificado
│   ├── lecciones.js       # Lecciones y «marcar como completada»
│   ├── guias.js           # Guías teóricas: subir, comprar, descargar
│   ├── estadisticas.js    # Panel principal: cifras, visitas y ventas por mes
│   ├── academia.js        # Diseño del certificado
│   ├── certificados.js    # «Mis certificados»
│   ├── dudas.js           # Dudas, respuestas, destacada, notificaciones, Comunidad
│   ├── trabajos.js        # Muro: publicar, permiso 👁/🔒, borrar
│   ├── resenas.js         # Reseñas: publicar, responder, borrar
│   ├── servicios.js       # Calculadora «Calcular mi precio» (y «Mostrar en mi perfil»)
│   ├── reportes.js        # Reportar y moderar
│   ├── mi-estilo.js       # Fase 2 · Mi Estilo: favoritos de la clienta
│   └── perfil.js          # Fase 2 · Perfil público de alumna y profesional
├── public/
│   ├── index.html         # Inicio: portada, accesos, cursos y talentos de la comunidad
│   ├── cursos.html        # Solo cursos, con filtros
│   ├── login.html · registro.html
│   ├── curso.html         # Detalle, progreso, lecciones, materiales, guías y reseñas
│   ├── leccion.html       # Vídeo + dudas de la lección
│   ├── certificado.html · certificados.html
│   ├── calculadora.html   # Calcular mi precio + Mis servicios
│   ├── muro.html          # Comunidad: 📷 Trabajos y ❓ Dudas
│   ├── avisos.html        # 🔔 Notificaciones
│   ├── admin.html         # Panel de la administradora (menú lateral)
│   ├── reportes.html      # ⚑ Reportes
│   ├── mi-estilo.html     # 💜 Mi Estilo (clienta): catálogo deslizable + Mis favoritos
│   ├── perfil.html        # 👤 Perfil público (?id=N)
│   ├── img/               # Logos, portada e ilustraciones
│   ├── css/estilos.css
│   └── js/api.js          # fetch, cabecera, menú lateral, notificaciones, reportar… (funciones comunes)
├── uploads/               # Fotos y vídeos subidos (imagenes/ y videos/), fuera de git
└── privado/guias/         # PDF de las guías: NO es pública, fuera de git
```

---

## Puesta en marcha (local)

Necesitas **Node.js** y **PostgreSQL** (con el servicio arrancado).

1. Instalar las dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env` y poner tu contraseña de PostgreSQL y un `SESSION_SECRET` propio.
3. Crear la base de datos y cargar las tablas y los datos de ejemplo:
   ```bash
   createdb -U postgres glamio
   npm run db:crear
   npm run db:datos
   ```
   > ⚠️ **`db:crear` solo la primera vez.** `schema.sql` empieza con `DROP TABLE`: si se vuelve a ejecutar,
   > **borra todas las usuarias, cursos y publicaciones**.
   >
   > **¿Ya tenías la base de antes?** No uses `db:crear`: aplica solo lo nuevo, en orden (ninguno borra nada):
   > - de antes del 17/11 (visitas, guías e importe de las ventas): `psql -U postgres -d glamio -f db/migracion-17-11.sql`
   > - de antes del 18/11 (Mi Estilo y perfil público): `psql -U postgres -d glamio -f db/migracion-18-11.sql`
   >
   > En Windows, si `psql` o `createdb` no se encuentran, están en `C:\Program Files\PostgreSQL\18\bin\`.
4. Crear la cuenta de la administradora (con una contraseña segura, no la de ejemplo):
   ```bash
   node db/crear-admin.js "Nombre de la administradora" admin@ejemplo.com "UnaContraseñaSegura!"
   ```
5. Arrancar:
   ```bash
   npm run dev
   ```
   Abrir **http://localhost:3000**

---

## Cuentas de prueba

En una instalación nueva no hay cuentas: se crean desde **Registrarme** (`/registro.html`) eligiendo el perfil (alumna, profesional o clienta). La administradora se crea con el paso 4.

En la base de la demo existen estas cuentas (solo en local, no son reales):

| Perfil | Email | Contraseña |
|---|---|---|
| Alumna | `alumna@glamio.local` | `Demo2026!` |
| Profesional | `profesional@glamio.local` | `Demo2026!` |
| Clienta | `clienta@glamio.local` | `Demo2026!` |
| Administradora | `admin@glamio.local` | *(la que se puso al crearla; no se guarda aquí)* |

¿Se olvidó una contraseña? `node db/cambiar-contrasena.js email "NuevaContraseña"` (mínimo 8 caracteres).

---

## Recorrido de la demo

1. **Aprendo**: como alumna, ir a **Cursos**, abrir uno, inscribirse (pago simulado si es de pago), ver las lecciones y marcarlas como completadas. Al terminar, **🎓 Ver mi certificado**. Comprar una **📖 guía teórica** y descargarla.
2. **Pregunto**: en una lección, hacer una duda con foto. Como administradora, **🔔 Notificaciones** avisa: responder y marcar **⭐ destacada**. La alumna recibe la notificación.
3. **Sé cuánto cobrar**: en el curso, **🧮 Calcular mi precio**. Se cargan los materiales; poner los costes, los minutos, el €/h y el margen, y guardar.
4. **Muestro mi resultado**: en **Comunidad → 📷 Trabajos**, publicar una foto etiquetada con el curso y dar permiso 👁. Como clienta, verla en el muro, guardarla con **♡** y abrirla en **💜 Mi Estilo**. Pulsar el nombre de la autora para ver su **👤 perfil público** (cursos terminados, trabajos y los servicios que haya marcado en la calculadora).
5. **Reseña**: dejar ⭐ en el curso terminado. La administradora responde.
6. **Moderación**: reportar algo con un motivo. Se oculta, y la administradora lo revisa en **⚑ Reportes**.
7. **Estadísticas**: como administradora, **Panel → 🏠 Panel principal**: visitas y cursos vendidos por mes.

---

## Reglas que cumple el código

| Regla | Dónde |
|---|---|
| Dudas solo de inscritas en el curso (RN-14) | `middleware/permisos.js` → `puedeEntrarEnLeccion()` |
| Solo la administradora marca la destacada, y hay **una por duda** (RN-15) | `requiereAdmin` + índice único parcial `una_destacada_por_duda` |
| Reseña solo con el curso terminado (RN-18) | `routes/resenas.js` + trigger `resena_solo_si_terminado` |
| Una reseña por persona y curso (RN-19) | `UNIQUE (usuaria_id, curso_id)` → responde 409 |
| De 1 a 5 estrellas (RN-20) | Validación en la ruta + `CHECK` |
| Las reseñas no las borra la administradora: se responden o se ocultan si un reporte lo confirma (RN-21) | `routes/resenas.js` y `routes/reportes.js` |
| La clienta solo recibe trabajos con permiso y no reportados (RN-22) | Filtro en el servidor, `routes/trabajos.js` |
| Mi Estilo: solo la clienta guarda favoritos, sin repetir, y solo de trabajos con permiso | `requierePerfil('clienta')` en `routes/mi-estilo.js` + clave primaria doble + trigger `favorito_solo_clienta` |
| El perfil público nunca enseña el email; los trabajos, con la regla del muro; los servicios, solo si ella los marca | `routes/perfil.js` + `PUT /api/servicios/:id/publico` (solo la dueña) |
| Solo se reporta lo que una misma puede ver | `puedeReportar()` en `routes/reportes.js` |
| Las guías solo las descarga quien las compró | `privado/guias` (no pública) + comprobación de compra en `routes/guias.js` |
| Borrar un curso con inscritas pide una segunda confirmación | `DELETE /api/cursos/:id` responde 409 hasta `?confirmar=si` |
| Pago simulado | `routes/cursos.js` y `routes/guias.js` (`pago_simulado: true`) |

**Seguridad:** contraseñas con `bcrypt`, perfiles comprobados **en el servidor** (no solo ocultando botones), SQL parametrizado, `multer` con tipo y tamaño limitados, textos escapados con `esc()` antes de pintarlos, y RGPD (consentimiento para las fotos, borrar lo propio y visitas guardadas **sin IP**).

---

## Fases

1. **Academia** ← esta entrega
2. Clientas: **Mi Estilo (favoritos) ✅ y perfil público ✅ ya en esta entrega** · pendiente: reserva de citas y reseñas por enlace tras la cita
3. Tienda / Stock
4. Otras academias publican cursos
