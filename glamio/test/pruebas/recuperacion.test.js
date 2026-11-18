// Pruebas de recuperación de contraseña y verificación de email (flujos 6 y 7)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../db/pool');
const {
  Sesion, nuevaUsuaria, registrarSinVerificar, emailUnico, ultimoCorreo, tokenDelCorreo
} = require('../ayudantes');

test.after(() => pool.end());

// Pide el enlace de recuperación y devuelve el token del correo
async function pedirEnlace(email) {
  const res = await new Sesion().post('/api/auth/recuperar', { email });
  assert.equal(res.estado, 200);
  return tokenDelCorreo(ultimoCorreo(email));
}

// ---------- 6. RECUPERACIÓN DE CONTRASEÑA ----------

test('recuperar: la respuesta es la misma exista o no la cuenta', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const existe = await new Sesion().post('/api/auth/recuperar', { email: registrada.usuaria.email });
  const noExiste = await new Sesion().post('/api/auth/recuperar', { email: emailUnico('nadie') });
  assert.equal(existe.estado, noExiste.estado);
  assert.deepEqual(existe.datos, noExiste.datos);
});

test('recuperar: si la cuenta no existe, no se envía ningún correo', async () => {
  const email = emailUnico('nadie');
  await new Sesion().post('/api/auth/recuperar', { email });
  assert.equal(ultimoCorreo(email), null);
});

test('recuperar: en la BD se guarda el hash del token, no el token', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const token = await pedirEnlace(registrada.usuaria.email);
  const { rows } = await pool.query('SELECT 1 FROM tokens_recuperacion WHERE id = $1', [token]);
  assert.equal(rows.length, 0);
});

test('restablecer: cambia la contraseña y cierra todas las sesiones', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const token = await pedirEnlace(sesion.usuaria.email);

  const res = await new Sesion().post('/api/auth/restablecer', { token, password: 'recuperada1' });
  assert.equal(res.estado, 200);

  assert.equal((await sesion.get('/api/auth/yo')).datos, null, 'la sesión abierta se cierra');
  const login = await new Sesion().post('/api/auth/login', { email: sesion.usuaria.email, password: 'recuperada1' });
  assert.equal(login.estado, 200);
});

test('restablecer: el enlace solo sirve UNA vez', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const token = await pedirEnlace(registrada.usuaria.email);

  assert.equal((await new Sesion().post('/api/auth/restablecer', { token, password: 'primera11' })).estado, 200);
  assert.equal((await new Sesion().post('/api/auth/restablecer', { token, password: 'segunda22' })).estado, 400);
});

test('restablecer: un enlace caducado no sirve', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const token = await pedirEnlace(registrada.usuaria.email);
  await pool.query(`UPDATE tokens_recuperacion SET caduca_en = NOW() - INTERVAL '1 minute' WHERE usuaria_id = $1`,
    [registrada.usuaria.id]);

  const res = await new Sesion().post('/api/auth/restablecer', { token, password: 'tarde1234' });
  assert.equal(res.estado, 400);
});

test('restablecer: un token inventado no sirve', async () => {
  const res = await new Sesion().post('/api/auth/restablecer', { token: 'inventado123', password: 'clave1234' });
  assert.equal(res.estado, 400);
});

test('restablecer: una contraseña débil no gasta el enlace', async () => {
  const registrada = await nuevaUsuaria('alumna');
  const token = await pedirEnlace(registrada.usuaria.email);

  assert.equal((await new Sesion().post('/api/auth/restablecer', { token, password: 'corta' })).estado, 400);
  assert.equal((await new Sesion().post('/api/auth/restablecer', { token, password: 'buena1234' })).estado, 200);
});

test('restablecer: si no había confirmado el email, el enlace también lo confirma', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const token = await pedirEnlace(sesion.usuaria.email);
  await new Sesion().post('/api/auth/restablecer', { token, password: 'nueva1234' });

  const login = await new Sesion().post('/api/auth/login', { email: sesion.usuaria.email, password: 'nueva1234' });
  assert.equal(login.estado, 200);
});

// ---------- 7. VERIFICACIÓN DE EMAIL ----------
// (el caso normal está en login.test.js)

test('verificar: el enlace solo sirve una vez', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const token = tokenDelCorreo(ultimoCorreo(sesion.usuaria.email));

  assert.equal((await new Sesion().post('/api/auth/verificar-email', { token })).estado, 200);
  assert.equal((await new Sesion().post('/api/auth/verificar-email', { token })).estado, 400);
});

test('verificar: un enlace caducado (más de 24 h) no sirve', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const token = tokenDelCorreo(ultimoCorreo(sesion.usuaria.email));
  await pool.query(`UPDATE tokens_verificacion SET caduca_en = NOW() - INTERVAL '1 minute' WHERE usuaria_id = $1`,
    [sesion.usuaria.id]);

  assert.equal((await new Sesion().post('/api/auth/verificar-email', { token })).estado, 400);
});

test('verificar: un token inventado no sirve', async () => {
  const res = await new Sesion().post('/api/auth/verificar-email', { token: 'inventado123' });
  assert.equal(res.estado, 400);
});

test('reenviar verificación (sin sesión): llega un enlace nuevo que funciona', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const primero = tokenDelCorreo(ultimoCorreo(sesion.usuaria.email));

  const res = await new Sesion().post('/api/auth/reenviar-verificacion', { email: sesion.usuaria.email });
  assert.equal(res.estado, 200);
  const segundo = tokenDelCorreo(ultimoCorreo(sesion.usuaria.email));
  assert.notEqual(segundo, primero);
  assert.equal((await new Sesion().post('/api/auth/verificar-email', { token: segundo })).estado, 200);
});

test('reenviar verificación: misma respuesta exista o no la cuenta, y no manda nada si no existe', async () => {
  const sesion = await registrarSinVerificar('alumna');
  const nadie = emailUnico('nadie');
  const existe = await new Sesion().post('/api/auth/reenviar-verificacion', { email: sesion.usuaria.email });
  const noExiste = await new Sesion().post('/api/auth/reenviar-verificacion', { email: nadie });
  assert.deepEqual(existe.datos, noExiste.datos);
  assert.equal(ultimoCorreo(nadie), null);
});

test('reenviar verificación: si ya está confirmada, no manda otro correo', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const antes = ultimoCorreo(sesion.usuaria.email);
  await new Sesion().post('/api/auth/reenviar-verificacion', { email: sesion.usuaria.email });
  assert.deepEqual(ultimoCorreo(sesion.usuaria.email), antes);
});
