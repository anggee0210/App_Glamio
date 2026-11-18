// =========================================
// Sesiones propias de GLAMIO (sustituye a express-session)
//
// Cómo funciona:
// 1. Al entrar, se crea un TOKEN aleatorio de 32 bytes y se manda al navegador en una cookie.
// 2. En la tabla "sesiones" se guarda solo su HUELLA (SHA-256), nunca el token.
// 3. En cada petición, cargarSesion() lee la cookie, calcula la huella y la busca en la BD.
//    Si existe y no ha caducado, rellena req.session.usuaria (igual que antes),
//    así el resto de rutas (cursos, reseñas, dudas...) no cambia nada.
//
// Caducidad deslizante: la sesión dura 30 días. Si la usuaria vuelve cuando
// quedan menos de 15, se renueva otros 30. Quien no entra en un mes, vuelve a hacer login.
// =========================================
const crypto = require('crypto');
const pool = require('../db/pool');

const NOMBRE_COOKIE = 'glamio_sesion';
const DIA = 24 * 60 * 60 * 1000;
const DURACION = 30 * DIA;      // 30 días
const RENOVAR_SI_QUEDAN = 15 * DIA; // si quedan menos de 15 días, se renueva

// Token aleatorio y seguro (32 bytes → texto apto para URL y cookies)
function crearToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Huella SHA-256 del token: es lo único que se guarda en la BD
function huella(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Lee nuestra cookie de la cabecera "Cookie" (sin librerías extra)
function leerCookie(req) {
  const cabecera = req.headers.cookie || '';
  for (const trozo of cabecera.split(';')) {
    const [nombre, ...resto] = trozo.trim().split('=');
    if (nombre === NOMBRE_COOKIE) return decodeURIComponent(resto.join('='));
  }
  return null;
}

// Opciones de la cookie:
// - httpOnly: el JavaScript de la página NO puede leerla (protege de XSS)
// - sameSite lax: no se envía desde formularios de otras webs (protege de CSRF)
// - secure: solo por HTTPS cuando la app esté publicada (en local no hay HTTPS)
function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION,
    path: '/'
  };
}

// Crea una sesión nueva en la BD y manda la cookie al navegador
async function crearSesion(req, res, usuariaId) {
  const token = crearToken();
  await pool.query(
    `INSERT INTO sesiones (id, usuaria_id, caduca_en, navegador)
     VALUES ($1, $2, NOW() + INTERVAL '30 days', $3)`,
    [huella(token), usuariaId, req.headers['user-agent'] || 'Desconocido']);
  res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
  return huella(token);
}

// Cierra UNA sesión (por la huella)
async function invalidarSesion(id) {
  await pool.query('DELETE FROM sesiones WHERE id = $1', [id]);
}

// Cierra TODAS las sesiones de una usuaria (en todos sus dispositivos)
async function invalidarTodas(usuariaId) {
  await pool.query('DELETE FROM sesiones WHERE usuaria_id = $1', [usuariaId]);
}

// Borra la cookie del navegador
function borrarCookie(res) {
  const { maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(NOMBRE_COOKIE, opciones);
}

// Middleware: se ejecuta en CADA petición y carga la usuaria si hay sesión válida
async function cargarSesion(req, res, next) {
  req.session = {}; // por defecto, sin sesión

  // Las imágenes, el CSS y el JS no necesitan saber quién eres: así no se consulta
  // la BD por cada archivo. Sí se mira en la API, en "/" y en las páginas .html
  // (estas últimas, para el contador de visitas).
  const esArchivo = !req.path.startsWith('/api') && req.path !== '/' && !req.path.endsWith('.html');
  if (esArchivo) return next();

  const token = leerCookie(req);
  if (!token) return next();

  try {
    const id = huella(token);
    const { rows } = await pool.query(
      `SELECT s.caduca_en, u.id, u.nombre, u.email, u.perfil, u.email_verificado_en
       FROM sesiones s JOIN usuarias u ON u.id = s.usuaria_id
       WHERE s.id = $1 AND s.caduca_en > NOW()
         AND u.bloqueada_en IS NULL`, [id]); // una cuenta bloqueada no tiene sesión

    if (!rows[0]) {
      // Cookie de una sesión cerrada o caducada: la borramos también del navegador
      borrarCookie(res);
      return next();
    }

    const fila = rows[0];
    req.session.id = id;
    req.session.usuaria = {
      id: fila.id, nombre: fila.nombre, email: fila.email, perfil: fila.perfil,
      email_verificado: fila.email_verificado_en !== null
    };

    // Caducidad deslizante: si quedan menos de 15 días, otros 30
    if (new Date(fila.caduca_en) - Date.now() < RENOVAR_SI_QUEDAN) {
      await pool.query(`UPDATE sesiones SET caduca_en = NOW() + INTERVAL '30 days' WHERE id = $1`, [id]);
      res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
    }
    next();
  } catch (err) { next(err); }
}

module.exports = {
  NOMBRE_COOKIE, crearToken, huella, leerCookie,
  crearSesion, invalidarSesion, invalidarTodas, borrarCookie, cargarSesion
};
