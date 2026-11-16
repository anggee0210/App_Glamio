# GLAMIO 💅

App web de formación en belleza (uñas, cabello y cejas): **academia de cursos**, **comunidad**, **calculadora de precios** y **reseñas verificadas**.

**Recorrido clave:** aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.

> Proyecto final de clase · Fase 1 (Academia) · Entrega: 25/11/2026
> GLAMIO es la app; los cursos los publica la **directora académica** de la academia.

---

## Perfiles

| Perfil | Qué puede hacer |
|---|---|
| **Directora académica** (administradora) | Crea y edita cursos, lecciones y materiales · diseña el certificado · responde dudas y marca la ⭐ destacada · responde reseñas · revisa los reportes |
| **Alumna** | Se inscribe (gratis o con pago simulado) · ve lecciones y marca su progreso · certificado · pregunta con foto · calculadora · publica sus trabajos · reseña cursos terminados |
| **Profesional** | Lo mismo que la alumna · su insignia es «Profesional certificada» |
| **Clienta** | Solo el **muro** en lectura: trabajos con permiso de su autora (fase 1) |

La cuenta de la directora no se puede crear desde la web: se crea con `db/crear-admin.js`.

---

## Qué hace (fase 1)

- **Academia**
  - Cursos gratis o de pago, con **pago simulado**: no se piden datos de tarjeta.
  - Lecciones con vídeo de YouTube o vídeo corto propio (máximo 50 MB).
  - Progreso por lección, **certificado** con diseño propio y página «Mis certificados».
- **Calculadora «Calcular mi precio»**
  - Desde un curso carga sus materiales. La alumna pone el coste, los minutos, el valor de su hora y el margen.
  - Fórmula: `(materiales + minutos/60 × precio_hora) × (1 + margen/100)`.
  - Se pueden guardar y borrar servicios propios («Mis precios»).
- **Comunidad**
  - **Dudas**: con foto en cada lección. Tienen respuestas y una **respuesta destacada** que solo marca la directora.
  - **Trabajos**: muro etiquetado por curso. La autora decide si las clientas ven su foto (👁/🔒) y puede borrarla.
- **Reseñas**
  - Solo de cursos terminados y una por persona, de 1 a 5 ⭐, con foto opcional.
  - La directora las responde. La autora puede borrarla, pero no editarla.
- **🔔 Notificaciones**
  - Directora: dudas sin responder y reseñas de 1 a 3 ⭐ sin respuesta.
  - Alumna y profesional: respuestas nuevas a sus dudas.
- **⚑ Reportes**
  - Lo reportado se oculta al momento.
  - La directora decide en su página si vuelve a publicarse.
- **Móvil**: menú ☰, botones pensados para el dedo y sin scroll horizontal.

---

## Stack

- **Frontend:** HTML, CSS y JavaScript (fetch), sin frameworks · diseño para el móvil
- **Backend:** Node.js + Express (API REST)
- **Base de datos:** PostgreSQL con `pg` (consultas parametrizadas `$1, $2`)
- **Login:** `express-session` + `bcrypt`
- **Archivos:** `multer` (imágenes y vídeos cortos; los vídeos largos, por YouTube)
- Todo funciona **en local**: sin servicios externos.

---

## Estructura

```
glamio/
├── server.js              # Servidor Express, rutas y manejo de errores
├── package.json
├── .env.example           # Copiar como .env
├── db/
│   ├── pool.js            # Conexión a PostgreSQL
│   ├── schema.sql         # Tablas, índices y trigger (¡borra todo! ver abajo)
│   ├── seed.sql           # Categorías, academia y cursos de ejemplo
│   ├── crear-admin.js     # Crea la cuenta de la directora académica
│   └── cambiar-contrasena.js # Cambia la contraseña de una cuenta (si se olvida)
├── middleware/
│   ├── auth.js            # requiereLogin / requiereAdmin / requierePerfil
│   ├── permisos.js        # esId() y puedeEntrarEnLeccion() (RN-14)
│   └── subidas.js         # multer: tipos y tamaño, rechazar() y borrarArchivo()
├── routes/
│   ├── auth.js            # Registro, login, logout, /yo
│   ├── categorias.js      # Uñas, Cabello, Cejas…
│   ├── cursos.js          # Cursos, materiales, inscripción, progreso, certificado
│   ├── lecciones.js       # Lecciones y «marcar como completada»
│   ├── academia.js        # Diseño del certificado
│   ├── certificados.js    # «Mis certificados»
│   ├── dudas.js           # Dudas, respuestas, destacada, notificaciones, Comunidad
│   ├── trabajos.js        # Muro: publicar, permiso 👁/🔒, borrar
│   ├── resenas.js         # Reseñas: publicar, responder, borrar
│   ├── servicios.js       # Calculadora «Calcular mi precio»
│   └── reportes.js        # Reportar y moderar
├── public/
│   ├── index.html         # Catálogo de cursos con filtro por categoría
│   ├── login.html · registro.html
│   ├── curso.html         # Detalle, progreso, materiales y reseñas
│   ├── leccion.html       # Vídeo + dudas de la lección
│   ├── certificado.html · certificados.html
│   ├── calculadora.html   # Mis precios
│   ├── muro.html          # Comunidad: 📷 Trabajos y ❓ Dudas
│   ├── avisos.html        # 🔔 Notificaciones
│   ├── admin.html         # Panel de la directora (pestañas)
│   ├── reportes.html      # ⚑ Reportes
│   ├── css/estilos.css
│   └── js/api.js          # fetch, menú, campana, reportar… (funciones comunes)
└── uploads/               # Archivos subidos (imagenes/ y videos/), fuera de git
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
   > **borra todas las usuarias, cursos y publicaciones**. Para cambios en una base que ya existe, se usa `ALTER TABLE`
   > (los que se han hecho están al final de `schema.sql`).
   >
   > En Windows, si `psql` o `createdb` no se encuentran, están en `C:\Program Files\PostgreSQL\18\bin\`.
4. Crear la cuenta de la directora académica (con una contraseña segura, no la de ejemplo):
   ```bash
   node db/crear-admin.js "Nombre de la directora" directora@ejemplo.com "UnaContraseñaSegura!"
   ```
5. Arrancar:
   ```bash
   npm run dev
   ```
   Abrir **http://localhost:3000**

---

## Cuentas de prueba

En una instalación nueva no hay cuentas: se crean desde **Registrarme** (`/registro.html`) eligiendo el perfil (alumna, profesional o clienta). La directora se crea con el paso 4.

En la base de la demo existen estas cuentas (solo en local, no son reales):

| Perfil | Email | Contraseña |
|---|---|---|
| Alumna | `alumna@glamio.local` | `Demo2026!` |
| Profesional | `profesional@glamio.local` | `Demo2026!` |
| Clienta | `clienta@glamio.local` | `Demo2026!` |
| Directora | `admin@glamio.local` | *(la que se puso al crearla; no se guarda aquí)* |

¿Se olvidó una contraseña? `node db/cambiar-contrasena.js email "NuevaContraseña"` (mínimo 8 caracteres).

---

## Recorrido de la demo

1. **Aprendo**: como alumna, abrir un curso, inscribirse (pago simulado si es de pago), ver las lecciones y marcarlas como completadas. Al terminar, **🎓 Ver mi certificado**.
2. **Pregunto**: en una lección, hacer una duda con foto. Como directora, la 🔔 avisa: responder y marcar **⭐ destacada**. La alumna recibe la notificación.
3. **Sé cuánto cobrar**: en el curso, **🧮 Calcular mi precio**. Se cargan los materiales; poner los costes, los minutos, el €/h y el margen, y guardar.
4. **Muestro mi resultado**: en **Comunidad → 📷 Trabajos**, publicar una foto etiquetada con el curso y dar permiso 👁. Como clienta, verla en el muro.
5. **Reseña**: dejar ⭐ en el curso terminado. La directora responde.
6. **Moderación**: reportar algo con un motivo. Se oculta, y la directora lo revisa en **⚑ Reportes**.

---

## Reglas que cumple el código

| Regla | Dónde |
|---|---|
| Dudas solo de inscritas en el curso (RN-14) | `middleware/permisos.js` → `puedeEntrarEnLeccion()` |
| Solo la directora marca la destacada, y hay **una por duda** (RN-15) | `requiereAdmin` + índice único parcial `una_destacada_por_duda` |
| Reseña solo con el curso terminado (RN-18) | `routes/resenas.js` + trigger `resena_solo_si_terminado` |
| Una reseña por persona y curso (RN-19) | `UNIQUE (usuaria_id, curso_id)` → responde 409 |
| De 1 a 5 estrellas (RN-20) | Validación en la ruta + `CHECK` |
| Las reseñas no las borra la directora: se responden o se ocultan si un reporte lo confirma (RN-21) | `routes/resenas.js` y `routes/reportes.js` |
| La clienta solo recibe trabajos con permiso y no reportados (RN-22) | Filtro en el servidor, `routes/trabajos.js` |
| Solo se reporta lo que una misma puede ver | `puedeReportar()` en `routes/reportes.js` |
| Pago simulado | `routes/cursos.js` (`pago_simulado: true`) |

**Seguridad:** contraseñas con `bcrypt`, perfiles comprobados **en el servidor** (no solo ocultando botones), SQL parametrizado, `multer` con tipo y tamaño limitados, textos escapados con `esc()` antes de pintarlos, y RGPD (consentimiento para las fotos y borrar lo propio).

---

## Fases

1. **Academia** ← esta entrega
2. Clientas: Mi Estilo (favoritos), perfil público de profesionales, reseñas por enlace tras la cita
3. Tienda / Stock
4. Otras academias publican cursos
