# GLAMIO – Login seguro

Un sistema de login no es un solo endpoint: son **7 flujos** que tienen que encajar.
Este documento explica qué hace cada uno, por qué, y en qué archivo está.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `db/schema.sql` | Tablas `sesiones`, `tokens_recuperacion`, `tokens_verificacion` y columna `email_verificado_en` |
| `middleware/sesiones.js` | Crear, cargar, renovar y cerrar sesiones (sustituye a express-session) |
| `middleware/contrasenas.js` | Cifrar y comprobar contraseñas con **Argon2id** (parámetros de OWASP) |
| `db/migracion-login.sql` | Añade las tablas del login a una base que ya existe (no borra nada) |
| `middleware/seguridad.js` | Normalizar email, política de contraseñas y límite de intentos |
| `middleware/correo.js` | Envío de correos **reales** con nodemailer (o simulados si no hay SMTP) |
| `routes/auth.js` | Los 7 flujos |
| `public/bloqueadas.html` | Panel de la administradora: cuentas bloqueadas y botón Desbloquear |
| `db/desbloquear-cuenta.js` | Desbloquear desde la terminal (por si la bloqueada es la administradora) |
| `public/cuenta.html` | Mi cuenta: cambiar contraseña, sesiones abiertas, cerrar todas |
| `public/recuperar.html`, `restablecer.html`, `verificar.html` | Recuperar contraseña y verificar email |
| `test/pruebas/login.test.js`, `cuenta.test.js`, `recuperacion.test.js` | Pruebas del harness (`npm test`) |

## Modelo de datos

Adaptado a GLAMIO: se mantiene la tabla `usuarias` (con sus perfiles) y se añaden:

- **`sesiones`**: una fila por dispositivo. El `id` es el **SHA-256 del token**, nunca el token.
  Guarda `caduca_en` y `navegador` (para la pantalla "tus sesiones abiertas").
- **`tokens_recuperacion`**: hash del token, caducidad (30 min) y `usado_en` (un solo uso).
- **`tokens_verificacion`**: hash del token y caducidad (24 h). Al usarse se borra.
- **`usuarias.email_verificado_en`**: NULL mientras no haya verificado.

**¿Por qué guardar solo el hash?** Si alguien robara la base de datos, vería huellas SHA-256,
y con una huella no se puede reconstruir el token, así que no podría entrar en ninguna cuenta.

## Contraseñas: Argon2id

Las contraseñas se guardan con **Argon2id** (librería `argon2`), con los parámetros mínimos que
recomienda OWASP: 19 MiB de memoria, 2 pasadas y 1 hilo.
- Ganó la *Password Hashing Competition* y es lo que recomienda OWASP hoy.
- Gasta memoria en cada intento, lo que hace muy caro probar millones de contraseñas con tarjetas gráficas.
- El hash lleva dentro el algoritmo, los parámetros y la sal: `$argon2id$v=19$m=19456,t=2,p=1$...`
- Todo el código usa solo `cifrarPassword()` y `comprobarPassword()` (`middleware/contrasenas.js`):
  si algún día se cambia de algoritmo, solo se toca ese archivo.

### Migración: las cuentas que ya existían no se pierden
- `db/migracion-login.sql` añade las tablas nuevas **sin borrar nada** y da por verificadas
  las cuentas que ya existían (se crearon cuando no había verificación).
- Todas las contraseñas están cifradas con Argon2id: el proyecto ya **no usa bcrypt**
  (las cuentas antiguas se pasaron a Argon2id el 24/11/2026 y se desinstaló la librería).
- Si algún día se suben los parámetros, `necesitaRecifrar()` hace que cada contraseña se
  vuelva a cifrar sola en el siguiente login, sin pedir a nadie que la cambie.

## Cómo funciona una sesión

1. Al entrar, el servidor crea un **token aleatorio de 32 bytes** y lo manda en la cookie `glamio_sesion`.
2. En la BD guarda solo su huella SHA-256.
3. En cada petición, `cargarSesion()` lee la cookie, calcula la huella y la busca.
   Si es válida, rellena `req.session.usuaria`, **igual que antes**: el resto de rutas no cambia.

La cookie es:
- `httpOnly`: el JavaScript de la página no puede leerla (protege de XSS).
- `sameSite: lax`: no se envía desde formularios de otras webs (protege de CSRF).
- `secure` en producción: solo viaja por HTTPS.

**Caducidad deslizante:** la sesión dura 30 días. Si la usuaria vuelve cuando quedan menos de 15,
se renueva otros 30. Quien no entra en un mes tiene que volver a hacer login.

## Los 7 flujos

### 1. Registro — `POST /api/auth/registro`
- Valida los datos (`errorRegistro`, hecho a mano en vez de Zod para no añadir librerías).
- Email normalizado: `trim()` y minúsculas.
- Política de contraseñas: mínimo 8 caracteres, máximo 128, al menos una letra y un número.
- Hash con **Argon2id** → crea la usuaria → token de verificación → **correo real**.
- **No inicia sesión**: la cuenta no se puede usar hasta confirmar el email.
- Si el email ya existe responde "email en uso" (aceptable en un proyecto de curso;
  lo más seguro sería responder siempre "Revisa tu correo").

### 2. Login — `POST /api/auth/login`
- **Límite de intentos antes de tocar la BD:** 5 fallos cada 15 minutos por IP + email → 429.
- **Mismo mensaje y mismo tiempo** si el email no existe o la contraseña está mal.
  Si el email no existe, se compara igualmente con un hash falso para que tarde lo mismo.
  Así no se puede averiguar qué emails están registrados.
- **Verificación obligatoria:** si la contraseña es correcta pero no ha confirmado su email → 403
  con la opción de pedir otro correo. Se comprueba *después* de la contraseña, así no revela qué emails existen.
- **Rotación de sesión:** siempre se crea una sesión nueva y se cierra la anterior.
  Evita la *fijación de sesión* (que alguien te "regale" una sesión antes de entrar y luego la use).

### Bloqueo de cuentas (3 intentos)
- Cada contraseña mal escrita suma 1 en `usuarias.intentos_fallidos`. **Al 3.er fallo** se guarda
  `bloqueada_en` y la cuenta queda **bloqueada**: se cierran todas sus sesiones y le llega un correo de aviso.
- El bloqueo está **en la API** (en el servidor), no solo en las páginas:
  - `POST /api/auth/login` responde **423** aunque la contraseña sea correcta.
  - `cargarSesion()` no reconoce sesiones de cuentas bloqueadas, así que **todas las rutas** de la API
    la tratan como si no hubiera entrado (401).
- El 3.er fallo responde **igual** que los demás ("Email o contraseña incorrectos"): así un atacante no sabe
  si la cuenta existe ni si la ha bloqueado. El aviso "cuenta bloqueada" solo sale con la contraseña **correcta**.
- Al acertar antes del 3.º, el contador vuelve a 0.
- Fallar 3 veces la contraseña actual en "Mi cuenta" también bloquea (por si alguien usa un ordenador que se dejó abierto).
- **Solo la administradora desbloquea**: Panel → 🔒 Cuentas bloqueadas (`GET /api/auth/bloqueadas` y
  `PUT /api/auth/bloqueadas/:id/desbloquear`). La usuaria recibe un correo. Recuperar la contraseña **no** desbloquea.
- Si la bloqueada es la propia administradora (no puede entrar al Panel): `node db/desbloquear-cuenta.js email`.
- Además hay un límite en memoria de 5 intentos cada 15 minutos por IP + email, que frena también
  a quien prueba emails que no existen.

### 3. Logout — `POST /api/auth/logout`
Primero se borra la sesión **en el servidor** y después la cookie del navegador.
Así, aunque alguien hubiera copiado la cookie, ya no le sirve.

### 4. Sesiones abiertas y cerrar todas
- `GET /api/auth/sesiones`: lista de dispositivos con sesión (marca cuál es el actual).
- `DELETE /api/auth/sesiones/:id`: cierra una concreta (solo las propias).
- `POST /api/auth/cerrar-todas`: cierra todas y crea una nueva para este dispositivo.
  Útil si pierde el móvil o sospecha algo.

### 5. Cambio de contraseña — `POST /api/auth/cambiar-password`
- Pide la contraseña **actual**, aunque haya sesión (por si alguien usa un ordenador que se dejó abierto).
- Guarda el hash nuevo.
- Cierra **todas** las sesiones y crea una nueva para este dispositivo.
- Envía el aviso "Tu contraseña ha cambiado".

### 6. Recuperación de contraseña
- `POST /api/auth/recuperar`: la respuesta es **siempre** la misma:
  "Si existe una cuenta con ese email, te hemos enviado un enlace".
  Si existe: token de 32 bytes, se guarda su hash con caducidad de 30 minutos y se envía el enlace.
- `POST /api/auth/restablecer`: busca por hash, comprueba caducidad y que no esté usado
  (todo en **una sola consulta**, así no se puede usar dos veces ni a la vez).
  Guarda la contraseña nueva y cierra todas las sesiones.
  La política se comprueba antes, para que una contraseña débil no gaste el enlace.

### 7. Verificación de email (obligatoria)
1. Al registrarse llega un **correo real** con el botón "Confirmar mi email".
2. El enlace lleva un token aleatorio; en la BD solo está su hash, caduca en 24 horas y es de un solo uso
   (se borra al usarlo).
3. Al pulsarlo (`verificar.html` → `POST /api/auth/verificar-email`) se marca `email_verificado_en`
   y **se inicia la sesión**: el enlace demuestra que el correo es suyo.
4. Si no le llega o caducó: en la página de entrar, botón "Enviarme otro correo de confirmación"
   (`POST /api/auth/reenviar-verificacion`). Respuesta siempre igual y con límite de peticiones.
5. Recuperar la contraseña también confirma el email (ese enlace también llegó a su correo).

## Correos reales (nodemailer + Gmail)

1. En tu cuenta de Gmail activa la **verificación en 2 pasos**.
2. Crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords
   (Google te da 16 letras: cópialas sin espacios). No uses tu contraseña normal de Gmail.
3. En el `.env`:
   ```
   CORREO_MODO=real
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USUARIO=tucorreo@gmail.com
   SMTP_PASSWORD=las16letras
   CORREO_REMITENTE="GLAMIO <tucorreo@gmail.com>"
   URL_APP=http://localhost:3000
   ```
4. Reinicia el servidor y regístrate con un email tuyo: te llegará el correo.

Si `SMTP_HOST` está vacío (o `CORREO_MODO=simulado`), los correos se simulan: salen en la consola
y en `correos/bandeja.jsonl`. Útil si un día no hay internet en la presentación.

## El harness (`npm test`) también usa correos reales

- Si el `.env` tiene SMTP, las pruebas **envían correos de verdad** a direcciones como
  `tucorreo+alumna.1731880000.1@gmail.com`. Gmail entrega todo lo que lleve `+algo` en tu buzón,
  así que te llegan a ti (puedes crear un filtro en Gmail para "+alumna" y archivarlos).
- Cada prueba comprueba que **Gmail aceptó el correo** (`correo_enviado: true`); si falla el envío, falla la prueba.
- Para seguir el enlace, el harness lee una copia local del mismo correo (`correos/bandeja.jsonl`),
  porque leer tu bandeja de Gmail necesitaría IMAP y otra librería.
- Una ejecución manda unos 60 correos. Gmail permite unos 500 al día: no lo ejecutes decenas de veces seguidas.
- `npm run test:simulado` ejecuta las mismas pruebas sin enviar correos (más rápido).

## Mejoras futuras
- Responder siempre "Revisa tu correo" en el registro (no revelar emails en uso).
- Guardar el límite de intentos en la BD (ahora está en memoria y se reinicia al apagar el servidor).
- Que el harness lea la bandeja de Gmail por IMAP para seguir el enlace del correo real.
