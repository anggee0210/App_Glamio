# GLAMIO 

App web de formación en belleza (uñas, cabello y cejas): **academia de cursos**, **comunidad**, **calculadora de precios**, **reseñas verificadas** y **guías teóricas**.

**Recorrido clave:** aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.

> Proyecto final de clase · Fase 1 (Academia) · Entrega: 25/11/2026
> GLAMIO es la app; los cursos los publica la **administradora** de la academia.

---

## Perfiles

| Perfil | Qué puede hacer |
|---|---|
| **Administradora** | Crea, edita y borra cursos, lecciones y materiales · sube guías teóricas en PDF · diseña el certificado · responde dudas y marca la ⭐ destacada · responde reseñas · revisa los reportes · ve las **estadísticas** · gestiona las **alumnas** (ficha personal, modificar, borrar) y desbloquea cuentas |
| **Alumna** | Se inscribe (gratis o con pago simulado) · ve lecciones y marca su progreso · certificado · compra guías · pregunta con foto · calculadora · publica sus trabajos · reseña cursos terminados · ve su **ficha personal** en Mi cuenta (sin poder cambiarla) · tiene **perfil público** (fase 2) |
| **Profesional** | Lo mismo que la alumna · su insignia es «Profesional certificada» |
| **Clienta** | El **muro** en lectura (trabajos con permiso de su autora) y **💜 Mi Estilo**: guarda con ♡ los que le gustan (fase 2) |

La cuenta de la administradora no se puede crear desde la web: se crea con `db/crear-admin.js`.

---

## Qué hace (fase 1)

- **Academia**
  - Página **Cursos** con botones por categoría (con cuántos cursos hay; «Próximamente» si una aún no tiene); cursos gratis o de pago, con **pago simulado** (no se piden datos de tarjeta).
  - **Portada de cada curso**: la administradora elige «Rellenar» (ocupa todo el cuadro) o «Completa» (la foto entera, con la misma foto difuminada detrás) y la encuadra arrastrándola en una vista previa pequeña.
  - Lecciones con vídeo de YouTube o vídeo corto propio (máximo 50 MB) y botón «Empezar / Continuar curso».
  - Progreso por lección y página «Mis certificados».
  - **Certificado con la plantilla de la administradora**: sube su fondo, su firma y su logo (cuadrado, redondo o desvanecido) y, en un editor, **arrastra** el nombre, el curso, la firma, el logo y la fecha/Nº a su sitio, les cambia el tamaño o los borra. Hoja **carta** horizontal en pantalla, al imprimir y en PDF. Los nombres largos se encogen para caber en una línea.
  - **📖 Guías teóricas en PDF** en cada curso: se compran con pago simulado y **solo las descarga quien las compró**.
- **Calculadora «Calcular mi precio»**
  - Desde un curso carga sus materiales. La alumna pone el coste, los minutos, el valor de su hora y el margen.
  - Fórmula: `(materiales + minutos/60 × precio_hora) × (1 + margen/100)`.
  - Los servicios se guardan en «Mis servicios» y se pueden borrar.
- **Comunidad** (pestañas Trabajos y Dudas)
  - **Dudas**: con foto en cada lección. Tienen respuestas y una **respuesta destacada** que solo marca la administradora.
  - **Trabajos**: muro etiquetado por curso. La autora decide con un **interruptor** «Visible para clientas» si las clientas ven su foto, y puede borrarla (la papelera pide pulsar dos veces).
- **Reseñas**
  - Solo de cursos terminados y una por persona, de 1 a 5 ⭐, con foto opcional.
  - La administradora las responde. La autora puede borrarla, pero no editarla.
- **🔔 Notificaciones** (una sola opción en el menú, con número rojo)
  - Administradora: dudas sin responder y reseñas de 1 a 3 ⭐ sin respuesta.
  - Alumna y profesional: respuestas nuevas a sus dudas.
- **⚑ Reportes**: lo reportado se oculta al momento; la administradora decide en su página si vuelve a publicarse.
- **Cuenta y seguridad**
  - Registro con **verificación de email**, «¿Olvidaste tu contraseña?» con enlace al correo y **⚙️ Mi cuenta** (cambiar contraseña, ver las sesiones abiertas y cerrarlas).
  - Al **3.er intento fallido** la cuenta se bloquea y solo la administradora la desbloquea. La página de entrar sale siempre **en blanco**.
- **👩‍🎓 Ficha personal de la alumna**
  - Nombre completo, lugar de nacimiento (país y ciudad), **documento de identidad según el país** (España → DNI, Colombia → Cédula de ciudadanía, México → CURP… y «Otro país» → Pasaporte; si nació fuera de España puede dar su **NIE**), fecha de nacimiento, dirección y teléfono.
  - Se comprueba la **letra del DNI/NIE**, el formato del documento de cada país y la **edad mínima de 14 años**.
  - **Solo la administradora** la crea y la modifica; la alumna la ve en **Mi cuenta → Mis datos**. Nunca sale en el perfil público.
- **Panel de la administradora** con **menú lateral** agrupado (Academia · Comunidad · Personas):
  - **🏠 Panel principal** con **estadísticas**: cursos, lecciones, alumnas, valoración media, **visitas a la app** y **cursos vendidos por mes** (gráficas y tabla), y los cursos más vendidos;
  - Mis cursos (editar y **borrar**, con doble confirmación si hay inscritas), Nuevo curso (con el ajuste de la portada), Nueva lección, Materiales, Certificado (con el editor de posiciones), Guías teóricas y Reportes;
  - **Alumnas**: lista con buscador y filtro (con o sin ficha) y, de cada una, **toda su información** (cuenta, ficha personal, cursos con su progreso y lo que ha hecho en la Comunidad). Desde ahí se **modifica** su ficha o el nombre/email con el que entra, se **borra la ficha** o se **borra la cuenta** entera (enseña antes lo que se perdería y pide confirmar);
  - **Cuentas bloqueadas**: tabla con quién está bloqueada y desde cuándo, y el botón Desbloquear.
- **Diseño**: morado y lila con detalles dorados, logo de la G dorada (en la cabecera y en el pie), botones limpios sin emojis, menú lateral del Panel en degradado claro con la palabra GLAMIO de fondo e iconos de línea, pantalla completa en el PC (letra más grande en monitores grandes) y menú ☰ en el móvil.

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
- **Login:** sesiones propias en PostgreSQL (cookie `httpOnly`) + contraseñas con **Argon2id** + verificación de email con correos reales (`nodemailer`). Detalle en `docs/LOGIN-SEGURO.md`
- **Archivos:** `multer` (imágenes, vídeos cortos y PDF de las guías; los vídeos largos, por YouTube)
- Todo funciona **en local**: sin servicios externos (las tipografías se cargan de Google Fonts y, sin internet, se usan las del sistema).

---

## Estructura

```
glamio/
├── server.js              # Servidor Express, contador de visitas, rutas y manejo de errores
├── package.json
├── .env.example           # Copiar como .env
├── CLAUDE.md              # Guía del proyecto para Claude (reglas, stack, tablas)
├── .claude/agents/        # Agentes de Claude Code: desarrollador (Opus 5.5) y revisor (Fable 5.2)
├── db/
│   ├── pool.js            # Conexión a PostgreSQL
│   ├── schema.sql         # Tablas, índices y trigger (¡borra todo! ver abajo)
│   ├── migracion-17-11.sql # Estadísticas y guías para una base que ya existe (no borra nada)
│   ├── migracion-18-11.sql # Fase 2: tabla favoritos y su trigger + servicios.publico (no borra nada)
│   ├── migracion-logo-certificado.sql # Certificado: logo, forma del logo y posiciones de los datos (no borra nada)
│   ├── migracion-portadas.sql # Portadas: ajuste Rellenar/Completa y posición de la foto (no borra nada)
│   ├── migracion-login.sql # Login seguro: sesiones, tokens y email verificado (no borra nada)
│   ├── migracion-ficha-alumna.sql # Ficha personal: países con su documento y fichas_alumnas (no borra nada)
│   ├── migracion-mas-paises.sql   # 31 países más para la ficha (48 en total; no borra nada)
│   ├── seed.sql           # Categorías, academia y cursos de ejemplo
│   ├── datos-demo.js      # Cuentas demo con datos para la presentación (npm run db:demo)
│   ├── copia-seguridad.js # Copia de la BD, uploads y privado (npm run copia)
│   ├── crear-admin.js     # Crea la cuenta de la administradora
│   ├── cambiar-contrasena.js # Cambia la contraseña de una cuenta (si se olvida)
│   ├── cambiar-email-admin.js # Cambia el email de la administradora
│   └── desbloquear-cuenta.js # Desbloquea una cuenta (si la bloqueada es la administradora)
├── middleware/
│   ├── auth.js            # requiereLogin / requiereAdmin / requierePerfil
│   ├── sesiones.js        # Sesiones propias: cookie glamio_sesion, SHA-256 en la BD, caducidad deslizante
│   ├── contrasenas.js     # Argon2id (cifrar y comprobar contraseñas)
│   ├── seguridad.js       # Email normalizado, política de contraseñas, límite de intentos
│   ├── correo.js          # Correos reales con nodemailer (o simulados)
│   ├── permisos.js        # esId() y puedeEntrarEnLeccion() (RN-14)
│   └── subidas.js         # multer: tipos y tamaño, rechazar() y borrarArchivo()
├── routes/
│   ├── auth.js            # Los 7 flujos del login: registro, login, logout, sesiones, cambiar, recuperar, verificar
│   ├── categorias.js      # Uñas, Cabello, Cejas…
│   ├── cursos.js          # Cursos (crear, editar, borrar), materiales, inscripción, progreso, certificado
│   ├── lecciones.js       # Lecciones y «marcar como completada»
│   ├── guias.js           # Guías teóricas: subir, comprar, descargar
│   ├── estadisticas.js    # Panel principal: cifras, visitas y ventas por mes
│   ├── academia.js        # Diseño del certificado (fondo, firma, logo y posiciones)
│   ├── certificados.js    # «Mis certificados»
│   ├── dudas.js           # Dudas, respuestas, destacada, notificaciones, Comunidad
│   ├── trabajos.js        # Muro: publicar, permiso 👁/🔒, borrar
│   ├── resenas.js         # Reseñas: publicar, responder, borrar
│   ├── servicios.js       # Calculadora «Calcular mi precio» (y «Mostrar en mi perfil»)
│   ├── reportes.js        # Reportar y moderar
│   ├── mi-estilo.js       # Fase 2 · Mi Estilo: favoritos de la clienta
│   ├── perfil.js          # Fase 2 · Perfil público de alumna y profesional
│   └── ficha.js           # Ficha personal y página Alumnas (ver, modificar y borrar: solo la administradora)
├── public/
│   ├── index.html         # Inicio: portada, ¿Qué quieres hacer hoy?, cursos y talentos de la comunidad
│   ├── cursos.html        # Solo cursos, con botones por categoría
│   ├── login.html · registro.html · recuperar.html · restablecer.html · verificar.html
│   ├── cuenta.html        # ⚙️ Mi cuenta: Mis datos (solo lectura), cambiar contraseña y sesiones abiertas
│   ├── curso.html         # Detalle, progreso, lecciones, materiales, guías y reseñas
│   ├── leccion.html       # Vídeo + dudas de la lección
│   ├── certificado.html · certificados.html
│   ├── calculadora.html   # Calcular mi precio + Mis servicios
│   ├── muro.html          # Comunidad: Trabajos y Dudas
│   ├── avisos.html        # 🔔 Notificaciones
│   ├── admin.html         # Panel de la administradora (menú lateral)
│   ├── reportes.html      # ⚑ Reportes
│   ├── alumnas.html       # Alumnas: toda la información de cada una, modificar y borrar (administradora)
│   ├── bloqueadas.html    # Cuentas bloqueadas (3 intentos fallidos): solo la administradora desbloquea
│   ├── mi-estilo.html     # 💜 Mi Estilo (clienta): catálogo deslizable + Mis favoritos
│   ├── perfil.html        # 👤 Perfil público (?id=N)
│   ├── simuladores/       # Vista previa de Tienda y Citas (sin base de datos, guarda en el navegador)
│   ├── img/               # Logos, portada, ilustraciones y fotos de la tienda
│   ├── css/estilos.css
│   ├── css/certificado-plantilla.css # La hoja del certificado y su editor
│   ├── js/api.js          # fetch, cabecera, menú lateral, notificaciones, reportar, portadas… (funciones comunes)
│   ├── js/catalogo.js     # Botones de categoría y tarjetas de curso (Cursos e Inicio)
│   ├── js/ficha-form.js   # Formulario de la ficha (el documento cambia con el país) y la ficha para leer
│   └── js/certificado-plantilla.js # Dónde va cada dato del certificado (certificado y editor del Panel)
├── test/                  # Harness de pruebas (npm test): login, permisos, reseñas, calculadora, ficha…
├── docs/                  # Documentación del proyecto
│   ├── LOGIN-SEGURO.md    # Cómo funciona el login, flujo a flujo
│   ├── GLAMIO_casos_de_uso.md # Casos de uso (actores, flujos y reglas)
│   ├── GLAMIO-Diseno-UX-UI.md # Diseño de pantallas y estilo
│   └── GLAMIO_instrucciones.md # Resumen corto del proyecto
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
2. Copiar `.env.example` a `.env` y poner tu contraseña de PostgreSQL y los datos de Gmail para los correos (ver `docs/LOGIN-SEGURO.md`).
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
   > - certificado con plantilla (logo y posiciones): `psql -U postgres -d glamio -f db/migracion-logo-certificado.sql`
   > - ajuste de las portadas de los cursos: `psql -U postgres -d glamio -f db/migracion-portadas.sql`
   > - login seguro (sesiones, recuperar contraseña, verificar email): `psql -U postgres -d glamio -f db/migracion-login.sql`
   >   Las cuentas que ya existían quedan verificadas, y sus contraseñas pasan solas a Argon2id al entrar.
   > - ficha personal de la alumna (países y documentos): `psql -U postgres -d glamio -f db/migracion-ficha-alumna.sql`
   > - más países para la ficha (después de la anterior): `psql -U postgres -d glamio -f db/migracion-mas-paises.sql`
   >
   > Si falta alguna, la parte que la usa (certificado, portadas, login o ficha) dará error. Se pueden ejecutar más de una vez sin problema.
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
| Administradora | *(el email con el que se creó en el paso 4)* | *(la que se puso al crearla; no se guarda aquí)* |

¿Se olvidó una contraseña? Desde **Entrar → ¿Olvidaste tu contraseña?** llega un enlace al correo. También se puede cambiar desde la terminal: `node db/cambiar-contrasena.js email "NuevaContraseña"` (mínimo 8 caracteres, con letras y números).

## Copia de seguridad

```bash
npm run copia
```
Guarda en **`Documentos\GLAMIO-copias\glamio-AAAA-MM-DD_HH-MM\`** la base de datos completa (`glamio.sql`) y las carpetas `uploads` (fotos y vídeos) y `privado` (PDF de las guías). Se puede cambiar la carpeta con `COPIAS_DIR` en el `.env`.

> ⚠️ La copia lleva **datos personales** (fichas de las alumnas) y contraseñas cifradas: se guarda **fuera del proyecto** para que nunca se suba a GitHub. Conviene guardar también la última en un USB.

**Recuperar una copia** (deja la base **igual que el día de la copia**: lo que se hizo después se pierde):
1. Parar el servidor.
2. Cargar la base: `psql -U postgres -d glamio -f "RUTA\DE\LA\COPIA\glamio.sql"`
3. Copiar de vuelta las carpetas `uploads` y `privado` de la copia a la carpeta del proyecto.
4. Arrancar el servidor.

## Pruebas automáticas (harness)

```bash
npm test              # con correos reales (si el .env tiene Gmail)
npm run test:simulado # sin enviar correos, más rápido
```
Usan una base de datos aparte (`glamio_test`): **no tocan tus datos**. Ahora mismo pasan **106 pruebas** (login, bloqueo, recuperación, Mi cuenta, permisos, comunidad, reseñas, calculadora, ficha de la alumna y guías).

## Hooks (protecciones automáticas)

| Hook | Dónde | Qué hace |
|---|---|---|
| **Proteger la BD real** | `.claude/settings.json` + `.claude/hooks/proteger-bd.js` | Antes de cada orden de Claude Code, **bloquea** ejecutar `schema.sql` (o `npm run db:crear`) en la BD `glamio`, porque empieza con `DROP TABLE`. En `glamio_test` sí se permite. |
| **Pruebas antes del commit** | `../.githooks/pre-commit` | Antes de cada commit que toque `glamio/`, pasa `npm run test:simulado`. Si alguna falla, **cancela el commit**. |

El hook de Git se activa una vez por ordenador, desde la carpeta del repositorio: `git config core.hooksPath .githooks`

---

## Recorrido de la demo

1. **Aprendo**: como alumna, ir a **Cursos**, abrir uno, inscribirse (pago simulado si es de pago), ver las lecciones y marcarlas como completadas. Al terminar, **🎓 Ver mi certificado**. Comprar una **📖 guía teórica** y descargarla.
2. **Pregunto**: en una lección, hacer una duda con foto. Como administradora, **🔔 Notificaciones** avisa: responder y marcar **⭐ destacada**. La alumna recibe la notificación.
3. **Sé cuánto cobrar**: en el curso, **🧮 Calcular mi precio**. Se cargan los materiales; poner los costes, los minutos, el €/h y el margen, y guardar.
4. **Muestro mi resultado**: en **Comunidad → 📷 Trabajos**, publicar una foto etiquetada con el curso y dar permiso 👁. Como clienta, verla en el muro, guardarla con **♡** y abrirla en **💜 Mi Estilo**. Pulsar el nombre de la autora para ver su **👤 perfil público** (cursos terminados, trabajos y los servicios que haya marcado en la calculadora).
5. **Reseña**: dejar ⭐ en el curso terminado. La administradora responde.
6. **Moderación**: reportar algo con un motivo. Se oculta, y la administradora lo revisa en **⚑ Reportes**.
7. **Estadísticas**: como administradora, **Panel → Panel principal**: visitas y cursos vendidos por mes.
8. **Alumnas**: **Panel → Alumnas**, elegir una y **Rellenar** su ficha (al elegir el país cambia el documento que se pide). Entrar como esa alumna y verla en **Mi cuenta → Mis datos**, sin poder cambiarla.

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
| Ficha personal: solo de alumnas, una por alumna; solo la administradora la crea, modifica y borra (la alumna recibe 403) | `routes/ficha.js` + clave primaria `usuaria_id` + trigger `ficha_solo_alumna` |
| El documento cumple el formato de su país (o NIE si nació fuera de España); letra del DNI/NIE correcta; edad mínima 14 años; el mismo documento no se repite | Tabla `paises` (patrón) + `validarFicha()` + `UNIQUE (pais_nacimiento, numero_documento)` e índice `un_nie_por_ficha` |
| Borrar la cuenta de una alumna pide confirmar y se lleva todo lo suyo (también sus fotos y los reportes sobre sus publicaciones) | `DELETE /api/ficha/alumnas/:id` responde 409 hasta `?confirmar=si` |

**Seguridad:** contraseñas con **Argon2id** (parámetros de OWASP), sesiones con token aleatorio guardado como SHA-256, cookie `httpOnly` + `SameSite`, bloqueo de la cuenta al 3.er intento fallido (solo la administradora desbloquea), verificación de email, perfiles comprobados **en el servidor** (no solo ocultando botones), SQL parametrizado, `multer` con tipo y tamaño limitados, textos escapados con `esc()` antes de pintarlos, y RGPD (consentimiento para las fotos, borrar lo propio, visitas guardadas **sin IP** y datos personales de la ficha visibles **solo para ella y la administradora**; si se borra la cuenta, la ficha se borra con ella).

---

## Fases

1. **Academia** ← esta entrega
2. Clientas: **Mi Estilo (favoritos) ✅ y perfil público ✅ ya en esta entrega** · pendiente: reserva de citas y reseñas por enlace tras la cita
3. Tienda / Stock
4. Otras academias publican cursos
