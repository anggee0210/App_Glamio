// =========================================
// LOGIN SEGURO DE GLAMIO – los 7 flujos
//  1. Registro                 POST /api/auth/registro
//  2. Login                    POST /api/auth/login
//  3. Logout                   POST /api/auth/logout
//  4. Sesiones abiertas        GET  /api/auth/sesiones  ·  DELETE /api/auth/sesiones/:id
//     Cerrar todas             POST /api/auth/cerrar-todas
//  5. Cambio de contraseña     POST /api/auth/cambiar-password
//  6. Recuperar contraseña     POST /api/auth/recuperar  →  POST /api/auth/restablecer
//  7. Verificar email          POST /api/auth/verificar-email  ·  POST /api/auth/reenviar-verificacion
//  +  Cuentas bloqueadas       GET  /api/auth/bloqueadas  ·  PUT /api/auth/bloqueadas/:id/desbloquear  (solo admin)
//
// La verificación es OBLIGATORIA: hasta que no confirma su email (con el enlace
// que le llega al correo), la cuenta no puede entrar.
//
// BLOQUEO: al 3.er intento fallido de contraseña la cuenta se BLOQUEA (se guarda en la BD).
// Una cuenta bloqueada no entra ni con la contraseña buena, y solo la administradora
// puede desbloquearla (página "Cuentas bloqueadas" del Panel).
//  +  ¿Quién soy?              GET  /api/auth/yo
// =========================================
const express = require('express');
const pool = require('../db/pool');
const { cifrarPassword, comprobarPassword, necesitaRecifrar } = require('../middleware/contrasenas'); // Argon2id
const { requiereLogin, requiereAdmin } = require('../middleware/auth');
const { esId } = require('../middleware/permisos');
const {
  crearToken, huella, crearSesion, invalidarSesion, invalidarTodas, borrarCookie
} = require('../middleware/sesiones');
const {
  normalizarEmail, errorPassword, errorRegistro,
  claveIntentos, minutosBloqueo, apuntarFallo, olvidarFallos
} = require('../middleware/seguridad');
const { enviarCorreo, urlApp } = require('../middleware/correo');
const { validarFicha, escribirFicha } = require('./ficha'); // ficha personal de la alumna
const router = express.Router();

// Perfiles que se pueden registrar solas (la admin se crea con db/crear-admin.js)
const PERFILES_PUBLICOS = ['alumna', 'profesional', 'clienta'];

const MENSAJE_LOGIN_MAL = 'Email o contraseña incorrectos';
const MAX_INTENTOS_CUENTA = 3; // al 3.er fallo, cuenta bloqueada
const MENSAJE_BLOQUEADA = 'Tu cuenta está bloqueada por demasiados intentos fallidos. ' +
  'Escribe a la academia para que la administradora la desbloquee.';
const MENSAJE_RECUPERAR = 'Si existe una cuenta con ese email, te hemos enviado un enlace';

// Datos públicos de la usuaria (NUNCA se devuelve la contraseña)
function datosPublicos(u) {
  return {
    id: u.id, nombre: u.nombre, email: u.email, perfil: u.perfil,
    email_verificado: u.email_verificado_en != null
  };
}

const MENSAJE_REENVIO = 'Si tu cuenta está pendiente de verificar, te hemos enviado un correo nuevo';

// Crea un token de verificación (24 h) y envía el correo.
// Devuelve true si el correo salió bien.
async function enviarVerificacion(usuaria) {
  const token = crearToken();
  await pool.query(
    `INSERT INTO tokens_verificacion (id, usuaria_id, caduca_en) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [huella(token), usuaria.id]);
  return enviarCorreo({
    para: usuaria.email,
    asunto: 'Confirma tu email en GLAMIO',
    texto: `Hola ${usuaria.nombre}, ¡bienvenida a GLAMIO! Confirma tu email para activar tu cuenta. ` +
           'El enlace caduca en 24 horas.',
    enlace: `${urlApp()}/verificar.html?token=${token}`,
    textoBoton: 'Confirmar mi email'
  });
}

// Apunta un intento fallido de contraseña en la cuenta. Al llegar a 3, la BLOQUEA:
// cierra todas sus sesiones y le manda un correo de aviso.
// Devuelve true si la cuenta acaba de quedar bloqueada.
async function apuntarFalloCuenta(usuaria) {
  // Todo en UNA consulta: suma 1 y, si llega al máximo, guarda la fecha del bloqueo
  const { rows } = await pool.query(
    `UPDATE usuarias
     SET intentos_fallidos = intentos_fallidos + 1,
         bloqueada_en = CASE WHEN intentos_fallidos + 1 >= $2 THEN NOW() ELSE NULL END
     WHERE id = $1 AND bloqueada_en IS NULL
     RETURNING bloqueada_en`, [usuaria.id, MAX_INTENTOS_CUENTA]);
  if (!rows[0] || !rows[0].bloqueada_en) return false;

  await invalidarTodas(usuaria.id); // si alguien intentaba entrar, que nadie siga dentro
  await enviarCorreo({
    para: usuaria.email,
    asunto: 'Tu cuenta de GLAMIO se ha bloqueado',
    texto: `Hola ${usuaria.nombre}, hemos bloqueado tu cuenta porque alguien ha escrito mal la contraseña ` +
           `${MAX_INTENTOS_CUENTA} veces seguidas. Si has sido tú, escribe a la academia para que la ` +
           'administradora la desbloquee. Si no has sido tú, te recomendamos cambiar la contraseña cuando la desbloqueen.'
  });
  return true;
}

// -----------------------------------------
// 1. REGISTRO
// Validar → (alumna: validar su ficha) → normalizar email → política de contraseña → hash
// → crear usuaria (+ ficha, en la misma transacción) → token de verificación → correo. NO se inicia sesión: primero tiene que verificar.
// -----------------------------------------
router.post('/registro', async (req, res, next) => {
  try {
    const { nombre, password, perfil } = req.body;
    const error = errorRegistro(req.body);
    if (error) return res.status(400).json({ error });
    if (!PERFILES_PUBLICOS.includes(perfil)) return res.status(400).json({ error: 'Perfil no válido' });

    // La alumna rellena su ficha personal AL REGISTRARSE (obligatoria, 24/11).
    // Se comprueba con las mismas reglas que usa el Panel (routes/ficha.js), ANTES de crear nada.
    let ficha = null;
    if (perfil === 'alumna') {
      const resultado = await validarFicha(req.body.ficha);
      if (resultado.error) return res.status(400).json({ error: resultado.error });
      ficha = resultado.ficha;
    }

    const email = normalizarEmail(req.body.email);
    const hash = await cifrarPassword(password); // Argon2id

    // TRANSACCIÓN: la cuenta y la ficha se guardan juntas. Si la ficha falla
    // (p. ej. el documento ya está en otra cuenta), tampoco se crea la cuenta.
    const cliente = await pool.connect();
    let usuaria;
    try {
      await cliente.query('BEGIN');
      const { rows } = await cliente.query(
        `INSERT INTO usuarias (nombre, email, password, perfil)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [String(nombre).trim(), email, hash, perfil]);
      usuaria = rows[0];
      if (ficha) await escribirFicha(cliente, usuaria.id, ficha);
      await cliente.query('COMMIT');
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err; // lo recoge el catch de abajo
    } finally {
      cliente.release();
    }

    const enviado = await enviarVerificacion(usuaria);
    res.status(201).json({
      ...datosPublicos(usuaria),
      correo_enviado: enviado,
      mensaje: enviado
        ? `Te hemos enviado un correo a ${usuaria.email}. Ábrelo para activar tu cuenta.`
        : 'Tu cuenta está creada, pero no pudimos enviar el correo. Pide otro desde la página de entrar.'
    });
  } catch (err) {
    // En un proyecto de curso aceptamos decir "email en uso"
    // (lo más seguro sería responder siempre "Revisa tu correo")
    // 23505 = valor repetido. Puede ser el email (usuarias) o el documento (fichas_alumnas)
    if (err.code === '23505' && err.table === 'fichas_alumnas')
      return res.status(409).json({ error: 'Ese documento ya está registrado en otra cuenta' });
    if (err.code === '23505') return res.status(400).json({ error: 'Ese email ya está registrado' });
    // P0001 = RAISE EXCEPTION de un trigger de la ficha (segunda barrera)
    if (err.code === 'P0001') return res.status(400).json({ error: err.message });
    next(err);
  }
});

// -----------------------------------------
// 2. LOGIN
// - Límite de intentos ANTES de tocar la BD
// - Mismo mensaje y mismo tiempo si el email no existe o la contraseña está mal
// - Rotación de sesión: siempre se crea una sesión NUEVA (evita la fijación de sesión)
// - Bloqueo: al 3.er fallo la cuenta se bloquea. El 3.er fallo responde lo MISMO que los
//   demás ("Email o contraseña incorrectos"): así nadie puede saber si ha bloqueado una cuenta
//   que existe. El aviso de "cuenta bloqueada" solo sale si se escribe la contraseña CORRECTA.
// -----------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

    const clave = claveIntentos(req, email);
    const minutos = minutosBloqueo(clave);
    if (minutos) {
      return res.status(429).json({ error: `Demasiados intentos. Vuelve a probar en ${minutos} minutos` });
    }

    const { rows } = await pool.query('SELECT * FROM usuarias WHERE email = $1', [normalizarEmail(email)]);
    const usuaria = rows[0];
    // Si no existe, se compara igualmente con un hash falso: mismo tiempo de respuesta
    const correcta = await comprobarPassword(password, usuaria ? usuaria.password : null);

    if (!usuaria || !correcta) {
      apuntarFallo(clave);
      if (usuaria) await apuntarFalloCuenta(usuaria); // al 3.º, cuenta bloqueada
      return res.status(401).json({ error: MENSAJE_LOGIN_MAL });
    }

    olvidarFallos(clave);

    // Cuenta bloqueada: no entra ni con la contraseña buena. Solo la admin la desbloquea.
    if (usuaria.bloqueada_en) {
      return res.status(423).json({ error: MENSAJE_BLOQUEADA, bloqueada: true }); // 423 = "bloqueado"
    }
    // Acertó: el contador de fallos vuelve a 0
    if (usuaria.intentos_fallidos > 0) {
      await pool.query('UPDATE usuarias SET intentos_fallidos = 0 WHERE id = $1', [usuaria.id]);
    }

    // Verificación obligatoria. Solo se dice DESPUÉS de comprobar la contraseña,
    // así no sirve para averiguar qué emails existen.
    if (!usuaria.email_verificado_en) {
      return res.status(403).json({
        error: 'Tienes que confirmar tu email antes de entrar. Revisa tu correo.',
        sin_verificar: true
      });
    }

    // Si su contraseña se guardó con parámetros más flojos que los actuales,
    // ahora que sabemos cuál es, la volvemos a cifrar con los nuevos.
    if (necesitaRecifrar(usuaria.password)) {
      await pool.query('UPDATE usuarias SET password = $1 WHERE id = $2', [await cifrarPassword(password), usuaria.id]);
    }

    if (req.session.id) await invalidarSesion(req.session.id); // rotación
    await crearSesion(req, res, usuaria.id);
    res.json(datosPublicos(usuaria));
  } catch (err) { next(err); }
});

// -----------------------------------------
// 3. LOGOUT: primero se cierra en el servidor, después se borra la cookie
// -----------------------------------------
router.post('/logout', async (req, res, next) => {
  try {
    if (req.session.id) await invalidarSesion(req.session.id); // primero el servidor
    borrarCookie(res);                                         // después el navegador
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ¿Quién soy? (null si no hay sesión)
router.get('/yo', (req, res) => {
  res.json(req.session.usuaria || null);
});

// -----------------------------------------
// 4. SESIONES ABIERTAS y CERRAR TODAS
// Útil si pierde el móvil o sospecha algo.
// -----------------------------------------
router.get('/sesiones', requiereLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, navegador, creada_en, caduca_en FROM sesiones
       WHERE usuaria_id = $1 AND caduca_en > NOW() ORDER BY creada_en DESC`,
      [req.session.usuaria.id]);
    // Marcamos cuál es la sesión de este dispositivo
    res.json(rows.map(s => ({ ...s, actual: s.id === req.session.id })));
  } catch (err) { next(err); }
});

// Cerrar UNA sesión concreta (solo si es suya)
router.delete('/sesiones/:id', requiereLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM sesiones WHERE id = $1 AND usuaria_id = $2 RETURNING id',
      [req.params.id, req.session.usuaria.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (req.params.id === req.session.id) borrarCookie(res); // si cierra la suya, sale
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Cerrar TODAS y abrir una nueva para este dispositivo
router.post('/cerrar-todas', requiereLogin, async (req, res, next) => {
  try {
    await invalidarTodas(req.session.usuaria.id);
    await crearSesion(req, res, req.session.usuaria.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// -----------------------------------------
// 5. CAMBIO DE CONTRASEÑA (con sesión iniciada)
// Pide la actual → guarda la nueva → cierra TODAS las sesiones
// → abre una nueva aquí → correo de aviso
// -----------------------------------------
router.post('/cambiar-password', requiereLogin, async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;
    const { rows } = await pool.query('SELECT * FROM usuarias WHERE id = $1', [req.session.usuaria.id]);
    const usuaria = rows[0];

    // Aunque tenga sesión, pedimos la contraseña actual.
    // Un fallo aquí también cuenta para el bloqueo (por si alguien usa un ordenador que se dejó abierto).
    if (!actual || !(await comprobarPassword(actual, usuaria.password))) {
      if (await apuntarFalloCuenta(usuaria)) {
        borrarCookie(res); // se acaba de bloquear: fuera
        return res.status(423).json({ error: MENSAJE_BLOQUEADA, bloqueada: true });
      }
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    const error = errorPassword(nueva);
    if (error) return res.status(400).json({ error });

    const hash = await cifrarPassword(nueva);
    await pool.query('UPDATE usuarias SET password = $1, intentos_fallidos = 0 WHERE id = $2', [hash, usuaria.id]);

    await invalidarTodas(usuaria.id);           // fuera de todos los dispositivos
    await crearSesion(req, res, usuaria.id);    // menos de este
    await enviarCorreo({
      para: usuaria.email,
      asunto: 'Tu contraseña de GLAMIO ha cambiado',
      texto: 'Si no has sido tú, recupera tu cuenta cuanto antes desde "¿Olvidaste tu contraseña?".',
      enlace: `${urlApp()}/recuperar.html`,
      textoBoton: 'No he sido yo'
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// -----------------------------------------
// 6. RECUPERACIÓN DE CONTRASEÑA
// a) /recuperar: la respuesta es SIEMPRE la misma (no revela si el email existe)
// b) /restablecer: busca por huella, comprueba caducidad y que no esté usado,
//    guarda la nueva, marca el token como usado y cierra todas las sesiones
// -----------------------------------------
router.post('/recuperar', async (req, res, next) => {
  try {
    const email = normalizarEmail(req.body.email);

    // Límite: máximo 5 peticiones cada 15 min (para no llenar el correo de nadie)
    const clave = 'recuperar|' + claveIntentos(req, email);
    if (minutosBloqueo(clave)) return res.json({ mensaje: MENSAJE_RECUPERAR });
    apuntarFallo(clave);

    const { rows } = await pool.query('SELECT id, nombre, email FROM usuarias WHERE email = $1', [email]);
    const usuaria = rows[0];
    if (usuaria) {
      const token = crearToken(); // 32 bytes aleatorios
      await pool.query(
        `INSERT INTO tokens_recuperacion (id, usuaria_id, caduca_en)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [huella(token), usuaria.id]);
      await enviarCorreo({
        para: usuaria.email,
        asunto: 'Recupera tu contraseña de GLAMIO',
        texto: `Hola ${usuaria.nombre}, pulsa el botón para crear una contraseña nueva. ` +
               'El enlace caduca en 30 minutos. Si no lo has pedido tú, ignora este correo.',
        enlace: `${urlApp()}/restablecer.html?token=${token}`,
        textoBoton: 'Crear contraseña nueva'
      });
    }
    res.json({ mensaje: MENSAJE_RECUPERAR }); // exista o no, la misma respuesta
  } catch (err) { next(err); }
});

router.post('/restablecer', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    // Primero la política: así un error de contraseña no gasta el enlace
    const error = errorPassword(password);
    if (error) return res.status(400).json({ error });
    if (!token) return res.status(400).json({ error: 'El enlace no es válido o ha caducado' });

    // Marcar como usado y comprobar en UNA sola consulta:
    // solo funciona si existe, no ha caducado y no se había usado (un solo uso)
    const { rows } = await pool.query(
      `UPDATE tokens_recuperacion SET usado_en = NOW()
       WHERE id = $1 AND usado_en IS NULL AND caduca_en > NOW()
       RETURNING usuaria_id`, [huella(String(token))]);
    if (!rows[0]) return res.status(400).json({ error: 'El enlace no es válido o ha caducado' });

    const hash = await cifrarPassword(password);
    // El enlace llegó a su correo, así que de paso queda verificado.
    // OJO: NO desbloquea la cuenta (eso solo lo puede hacer la administradora).
    const cambiada = await pool.query(
      `UPDATE usuarias SET password = $1, email_verificado_en = COALESCE(email_verificado_en, NOW()),
              intentos_fallidos = CASE WHEN bloqueada_en IS NULL THEN 0 ELSE intentos_fallidos END
       WHERE id = $2 RETURNING bloqueada_en`,
      [hash, rows[0].usuaria_id]);
    await invalidarTodas(rows[0].usuaria_id); // fuera de todos los dispositivos
    const sigueBloqueada = cambiada.rows[0].bloqueada_en !== null;
    res.json({
      ok: true,
      bloqueada: sigueBloqueada,
      mensaje: sigueBloqueada
        ? 'Contraseña cambiada, pero tu cuenta sigue bloqueada: la administradora tiene que desbloquearla.'
        : 'Contraseña cambiada. Ya puedes entrar con la nueva.'
    });
  } catch (err) { next(err); }
});

// -----------------------------------------
// 7. VERIFICACIÓN DE EMAIL
// Mismo patrón: token aleatorio, huella en BD, caduca en 24 h, un solo uso
// (al usarlo se BORRA, así no se puede usar dos veces).
// Al verificar, se inicia la sesión: el enlace demuestra que el correo es suyo.
// -----------------------------------------
router.post('/verificar-email', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM tokens_verificacion WHERE id = $1 AND caduca_en > NOW() RETURNING usuaria_id`,
      [huella(String(req.body.token || ''))]);
    if (!rows[0]) return res.status(400).json({ error: 'El enlace no es válido o ha caducado' });

    const verificada = await pool.query(
      `UPDATE usuarias SET email_verificado_en = COALESCE(email_verificado_en, NOW())
       WHERE id = $1 RETURNING *`, [rows[0].usuaria_id]);
    const usuaria = verificada.rows[0];

    if (req.session.id) await invalidarSesion(req.session.id); // rotación
    await crearSesion(req, res, usuaria.id);
    res.json({ ok: true, mensaje: '¡Email confirmado! Ya puedes usar GLAMIO.', usuaria: datosPublicos(usuaria) });
  } catch (err) { next(err); }
});

// Por si el correo no llegó o el enlace caducó: pedir otro (sin sesión, con el email).
// Respuesta siempre igual (no revela qué emails existen) y con límite de peticiones.
router.post('/reenviar-verificacion', async (req, res, next) => {
  try {
    const email = normalizarEmail(req.body.email);
    const clave = 'reenviar|' + claveIntentos(req, email);
    if (minutosBloqueo(clave)) return res.json({ mensaje: MENSAJE_REENVIO });
    apuntarFallo(clave);

    const { rows } = await pool.query(
      'SELECT * FROM usuarias WHERE email = $1 AND email_verificado_en IS NULL', [email]);
    if (rows[0]) await enviarVerificacion(rows[0]);
    res.json({ mensaje: MENSAJE_REENVIO });
  } catch (err) { next(err); }
});

// -----------------------------------------
// CUENTAS BLOQUEADAS (solo la administradora)
// -----------------------------------------
// Lista de cuentas bloqueadas, la más reciente primero
router.get('/bloqueadas', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, email, perfil, bloqueada_en FROM usuarias
       WHERE bloqueada_en IS NOT NULL ORDER BY bloqueada_en DESC`);
    res.json(rows);
  } catch (err) { next(err); }
});

// Desbloquear una cuenta: vuelve a poder entrar y el contador de fallos empieza de 0
router.put('/bloqueadas/:id/desbloquear', requiereAdmin, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Cuenta no encontrada' });
    const { rows } = await pool.query(
      `UPDATE usuarias SET bloqueada_en = NULL, intentos_fallidos = 0
       WHERE id = $1 AND bloqueada_en IS NOT NULL RETURNING nombre, email`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Esa cuenta no está bloqueada' });

    await enviarCorreo({
      para: rows[0].email,
      asunto: 'Tu cuenta de GLAMIO ya está desbloqueada',
      texto: `Hola ${rows[0].nombre}, la administradora ha desbloqueado tu cuenta. Ya puedes entrar. ` +
             'Si no recuerdas la contraseña, usa "¿Olvidaste tu contraseña?".',
      enlace: `${urlApp()}/login.html`,
      textoBoton: 'Entrar en GLAMIO'
    });
    res.json({ ok: true, mensaje: `Cuenta de ${rows[0].nombre} desbloqueada` });
  } catch (err) { next(err); }
});

module.exports = router;
