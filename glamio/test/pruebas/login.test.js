// Pruebas del registro, login, logout y sesiones (flujos 1, 2 y 3)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const pool = require('../../db/pool');
const { URL_BASE } = require('../config');
const {
  Sesion, nuevaUsuaria, registrarSinVerificar, emailUnico, ultimoCorreo, tokenDelCorreo, fichaDePrueba
} = require('../ayudantes');

test.after(() => pool.end());

// Saca el token de la cookie "glamio_sesion=XXXX"
function tokenDeCookie(sesion) {
  return sesion.cookie.split('=')[1];
}

// ---------- 1. REGISTRO ----------

test('registro: crea la cuenta pero NO entra hasta confirmar el email', async () => {
  const sesion = new Sesion();
  const email = emailUnico('alumna');
  const res = await sesion.post('/api/auth/registro', { nombre: 'Lucía', email, password: 'clave1234', perfil: 'alumna', ficha: fichaDePrueba() });
  assert.equal(res.estado, 201);
  assert.equal(res.datos.perfil, 'alumna');
  assert.equal(res.datos.email_verificado, false);
  assert.equal(res.datos.correo_enviado, true);

  const yo = await sesion.get('/api/auth/yo');
  assert.equal(yo.datos, null, 'sin confirmar el email no hay sesión');
});

test('verificación obligatoria: sin confirmar, el login con la contraseña buena → 403', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const res = await new Sesion().post('/api/auth/login',
    { email: sesion.usuaria.email, password: sesion.usuaria.password });
  assert.equal(res.estado, 403);
  assert.equal(res.datos.sin_verificar, true);
});

test('verificación obligatoria: sin confirmar y con contraseña MALA → 401 (no revela nada)', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const res = await new Sesion().post('/api/auth/login', { email: sesion.usuaria.email, password: 'mala1234' });
  assert.equal(res.estado, 401);
  assert.equal(res.datos.sin_verificar, undefined);
});

test('verificación: con el enlace del correo confirma el email y entra', async () => {
  const sesion = await registrarSinVerificar('profesional');
  const token = tokenDelCorreo(ultimoCorreo(sesion.usuaria.email));

  const res = await sesion.post('/api/auth/verificar-email', { token });
  assert.equal(res.estado, 200);
  const yo = await sesion.get('/api/auth/yo');
  assert.equal(yo.datos.email, sesion.usuaria.email);
  assert.equal(yo.datos.email_verificado, true);

  // Y a partir de ahora puede hacer login normal
  const login = await new Sesion().post('/api/auth/login',
    { email: sesion.usuaria.email, password: sesion.usuaria.password });
  assert.equal(login.estado, 200);
});

test('registro: el email se guarda sin espacios y en minúsculas', async () => {
  const email = emailUnico('mayus');
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Ana', email: `  ${email.toUpperCase()}  `, password: 'clave1234', perfil: 'alumna', ficha: fichaDePrueba() });
  assert.equal(res.estado, 201);
  assert.equal(res.datos.email, email);

  // Confirma el email y puede entrar escribiéndolo como quiera
  await new Sesion().post('/api/auth/verificar-email', { token: tokenDelCorreo(ultimoCorreo(email)) });
  const login = await new Sesion().post('/api/auth/login', { email: email.toUpperCase(), password: 'clave1234' });
  assert.equal(login.estado, 200);
});

test('registro: política de contraseñas (mínimo 8, con letra y número)', async () => {
  for (const password of ['corta1', 'sinnumeros', '12345678']) {
    const res = await new Sesion().post('/api/auth/registro',
      { nombre: 'Débil', email: emailUnico('debil'), password, perfil: 'alumna' });
    assert.equal(res.estado, 400, `"${password}" no debería aceptarse`);
  }
});

test('registro: envía un correo de verificación con el enlace', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const correo = ultimoCorreo(sesion.usuaria.email);
  assert.ok(correo, 'debería haber un correo');
  assert.match(correo.texto, /verificar\.html\?token=/);
});

test('registro: no se puede registrar dos veces el mismo email', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Copia', email: sesion.usuaria.email, password: 'otra1234', perfil: 'alumna', ficha: fichaDePrueba() });
  assert.equal(res.estado, 400);
});

// ---------- Ficha personal en el registro (24/11) ----------

test('registro de alumna SIN ficha → 400 y no se crea la cuenta', async () => {
  const email = emailUnico('sinficha');
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Sin Ficha', email, password: 'clave1234', perfil: 'alumna' });
  assert.equal(res.estado, 400);
  const { rows } = await pool.query('SELECT id FROM usuarias WHERE email = $1', [email]);
  assert.equal(rows.length, 0, 'sin ficha no debe quedar la cuenta a medias');
});

test('registro de alumna con la ficha mal (DNI con la letra mal) → 400 con el mensaje de la ficha', async () => {
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Letra Mal', email: emailUnico('letra'), password: 'clave1234', perfil: 'alumna',
      ficha: fichaDePrueba({ numero_documento: '12345678A' }) }); // la buena sería la Z
  assert.equal(res.estado, 400);
  assert.match(res.datos.error, /letra del DNI/);
});

test('registro de alumna con ficha: se guardan la cuenta y la ficha juntas', async () => {
  const ficha = fichaDePrueba({ telefono: '+34 600 222 333' });
  const limpio = ficha.numero_documento; // p. ej. 30012345Z
  // Se escribe con puntos, guion y en minúscula, como lo haría una persona: "30.012.345-z"
  ficha.numero_documento = `${limpio.slice(0, 2)}.${limpio.slice(2, 5)}.${limpio.slice(5, 8)}-${limpio[8].toLowerCase()}`;
  const email = emailUnico('conficha');
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Con Ficha', email, password: 'clave1234', perfil: 'alumna', ficha });
  assert.equal(res.estado, 201, JSON.stringify(res.datos));
  const { rows } = await pool.query(
    `SELECT f.numero_documento, f.telefono FROM fichas_alumnas f
     JOIN usuarias u ON u.id = f.usuaria_id WHERE u.email = $1`, [email]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].numero_documento, limpio, 'el documento se guarda limpio');
  assert.equal(rows[0].telefono, '+34600222333');
});

test('registro con un documento que ya tiene otra alumna → 409 y NO se crea la cuenta (transacción)', async () => {
  const ficha = fichaDePrueba();
  const primera = await new Sesion().post('/api/auth/registro',
    { nombre: 'Primera', email: emailUnico('doc1'), password: 'clave1234', perfil: 'alumna', ficha });
  assert.equal(primera.estado, 201);

  const email = emailUnico('doc2');
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Segunda', email, password: 'clave1234', perfil: 'alumna', ficha: { ...ficha } });
  assert.equal(res.estado, 409);
  const { rows } = await pool.query('SELECT id FROM usuarias WHERE email = $1', [email]);
  assert.equal(rows.length, 0, 'la cuenta no se queda creada sin su ficha');
});

test('profesional y clienta se registran sin ficha (y si la mandan, se ignora)', async () => {
  for (const perfil of ['profesional', 'clienta']) {
    const email = emailUnico(perfil);
    const res = await new Sesion().post('/api/auth/registro',
      { nombre: 'Sin Ficha', email, password: 'clave1234', perfil, ficha: fichaDePrueba() });
    assert.equal(res.estado, 201, perfil);
    const { rows } = await pool.query(
      'SELECT 1 FROM fichas_alumnas f JOIN usuarias u ON u.id = f.usuaria_id WHERE u.email = $1', [email]);
    assert.equal(rows.length, 0, `${perfil} no tiene ficha`);
  }
});

test('registro: nadie puede registrarse como administradora', async () => {
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Lista', email: emailUnico('falsa'), password: 'clave1234', perfil: 'administradora' });
  assert.equal(res.estado, 400);
});

test('registro: faltan datos → 400', async () => {
  const res = await new Sesion().post('/api/auth/registro', { email: emailUnico('x'), perfil: 'alumna' });
  assert.equal(res.estado, 400);
});

test('registro: la contraseña se guarda cifrada con Argon2id, no en texto plano', async () => {
  const sesion = await nuevaUsuaria('profesional');
  const { rows } = await pool.query('SELECT password FROM usuarias WHERE email = $1', [sesion.usuaria.email]);
  assert.notEqual(rows[0].password, sesion.usuaria.password);
  // Así empiezan los hash de Argon2id, con los parámetros de OWASP (19 MiB, 2 pasadas, 1 hilo)
  assert.match(rows[0].password, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
});

// ---------- 2. LOGIN ----------

test('login: con email y contraseña correctos entra y devuelve su perfil', async () => {
  const registrada = await nuevaUsuaria('clienta');
  const res = await new Sesion().post('/api/auth/login',
    { email: registrada.usuaria.email, password: registrada.usuaria.password });
  assert.equal(res.estado, 200);
  assert.equal(res.datos.perfil, 'clienta');
  assert.equal(res.datos.password, undefined, 'el login nunca debe devolver la contraseña');
});

test('login: contraseña incorrecta → 401', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const res = await new Sesion().post('/api/auth/login', { email: registrada.usuaria.email, password: 'mala1234' });
  assert.equal(res.estado, 401);
});

test('login: email que no existe → mismo 401 y mismo mensaje (no revela qué emails existen)', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const malaClave = await new Sesion().post('/api/auth/login', { email: registrada.usuaria.email, password: 'mala1234' });
  const noExiste = await new Sesion().post('/api/auth/login', { email: emailUnico('nadie'), password: 'mala1234' });
  assert.equal(noExiste.estado, 401);
  assert.equal(noExiste.datos.error, malaClave.datos.error);
});

test('login: faltan datos → 400 (no 500)', async () => {
  const res = await new Sesion().post('/api/auth/login', { email: 'algo@pruebas.glamio' });
  assert.equal(res.estado, 400);
});

test('login: límite por IP + email (5 fallos en 15 min → 429), también con emails que no existen', async () => {
  // El bloqueo de CUENTA está en bloqueo.test.js; esto frena a quien prueba emails al azar
  const email = emailUnico('nadie');
  for (let i = 0; i < 5; i++) {
    const fallo = await new Sesion().post('/api/auth/login', { email, password: 'mala1234' });
    assert.equal(fallo.estado, 401);
  }
  const frenada = await new Sesion().post('/api/auth/login', { email, password: 'mala1234' });
  assert.equal(frenada.estado, 429);
});

test('login: rotación de sesión (el token cambia y el viejo deja de valer)', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const cookieVieja = sesion.cookie;

  await sesion.post('/api/auth/login', { email: sesion.usuaria.email, password: sesion.usuaria.password });
  assert.notEqual(sesion.cookie, cookieVieja, 'el login debe crear un token nuevo');

  const conCookieVieja = new Sesion();
  conCookieVieja.cookie = cookieVieja;
  const yo = await conCookieVieja.get('/api/auth/yo');
  assert.equal(yo.datos, null, 'el token viejo ya no debe servir');
});

// ---------- COOKIE DE SESIÓN ----------

test('cookie: es httpOnly, SameSite=Lax, para toda la app y dura 30 días', async () => {
  const registrada = await nuevaUsuaria('alumna');
  // Aquí usamos fetch directamente para ver la cabecera Set-Cookie completa
  const res = await fetch(`${URL_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: registrada.usuaria.email, password: registrada.usuaria.password })
  });
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('glamio_sesion='));
  assert.ok(cookie, 'el login debe mandar la cookie glamio_sesion');

  assert.match(cookie, /HttpOnly/i, 'el JavaScript de la página no debe poder leerla (XSS)');
  assert.match(cookie, /SameSite=Lax/i, 'no debe enviarse desde otras webs (CSRF)');
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Max-Age=2592000/i, '30 días = 2.592.000 segundos');
});

test('cookie: el token es aleatorio y largo (32 bytes), distinto en cada login', async () => {
  const a = await nuevaUsuaria('alumna');
  const b = await nuevaUsuaria('alumna');
  const tokenA = tokenDeCookie(a);
  assert.ok(tokenA.length >= 43, '32 bytes en base64url son 43 caracteres');
  assert.notEqual(tokenA, tokenDeCookie(b));
});

test('cookie: al hacer logout se borra del navegador', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const res = await fetch(`${URL_BASE}/api/auth/logout`, { method: 'POST', headers: { Cookie: sesion.cookie } });
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('glamio_sesion='));
  assert.ok(cookie, 'el logout debe mandar la orden de borrar la cookie');
  assert.match(cookie, /glamio_sesion=;/, 'la cookie se vacía');
  assert.match(cookie, /Expires=Thu, 01 Jan 1970/i, 'y caduca en el pasado');
});

test('cookie: una cookie inventada no da acceso y el servidor la borra', async () => {
  const res = await fetch(`${URL_BASE}/api/auth/yo`, { headers: { Cookie: 'glamio_sesion=inventada123' } });
  assert.equal(await res.json(), null);
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('glamio_sesion='));
  assert.ok(cookie, 'el servidor debe borrar la cookie inválida');
});

// ---------- SESIONES EN LA BD ----------

test('sesiones: en la BD se guarda el SHA-256 del token, nunca el token', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const token = tokenDeCookie(sesion);
  const huella = crypto.createHash('sha256').update(token).digest('hex');

  const conToken = await pool.query('SELECT 1 FROM sesiones WHERE id = $1', [token]);
  assert.equal(conToken.rows.length, 0);
  const conHuella = await pool.query('SELECT 1 FROM sesiones WHERE id = $1', [huella]);
  assert.equal(conHuella.rows.length, 1);
});

test('sesiones: caducidad deslizante (si quedan menos de 15 días, se renueva a 30)', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const id = sesion.usuaria.id;
  await pool.query(`UPDATE sesiones SET caduca_en = NOW() + INTERVAL '10 days' WHERE usuaria_id = $1`, [id]);

  await sesion.get('/api/auth/yo'); // vuelve a la app

  const { rows } = await pool.query(
    `SELECT caduca_en > NOW() + INTERVAL '29 days' AS renovada FROM sesiones WHERE usuaria_id = $1`, [id]);
  assert.equal(rows[0].renovada, true);
});

test('sesiones: si caducó (no entró en un mes) tiene que volver a hacer login', async () => {
  const sesion = await nuevaUsuaria('alumna');
  await pool.query(`UPDATE sesiones SET caduca_en = NOW() - INTERVAL '1 minute' WHERE usuaria_id = $1`,
    [sesion.usuaria.id]);
  const yo = await sesion.get('/api/auth/yo');
  assert.equal(yo.datos, null);
});

// ---------- 3. LOGOUT ----------

test('logout: cierra la sesión en el servidor (el token ya no vale aunque se copie)', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const copia = new Sesion();
  copia.cookie = sesion.cookie; // alguien copió la cookie

  await sesion.post('/api/auth/logout');
  assert.equal((await sesion.get('/api/auth/yo')).datos, null);
  assert.equal((await copia.get('/api/auth/yo')).datos, null, 'la copia tampoco debe servir');
});

test('rutas protegidas: sin sesión → 401', async () => {
  const res = await new Sesion().get('/api/servicios');
  assert.equal(res.estado, 401);
});
