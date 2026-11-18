// Bloqueo de cuentas: al 3.er intento fallido la cuenta se bloquea
// y solo la administradora puede desbloquearla.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../db/pool');
const { Sesion, nuevaUsuaria, sesionAdmin, ultimoCorreo, tokenDelCorreo } = require('../ayudantes');

test.after(() => pool.end());

// Escribe mal la contraseña "veces" veces y devuelve las respuestas
async function fallar(sesion, veces) {
  const respuestas = [];
  for (let i = 0; i < veces; i++) {
    respuestas.push(await new Sesion().post('/api/auth/login', { email: sesion.usuaria.email, password: 'mala1234' }));
  }
  return respuestas;
}

// Entra con la contraseña buena
function entrar(sesion, password = sesion.usuaria.password) {
  return new Sesion().post('/api/auth/login', { email: sesion.usuaria.email, password });
}

test('al 3.er fallo la cuenta queda bloqueada: ni con la contraseña buena entra (423)', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await fallar(alumna, 3);

  const res = await entrar(alumna);
  assert.equal(res.estado, 423);
  assert.equal(res.datos.bloqueada, true);

  const { rows } = await pool.query('SELECT bloqueada_en FROM usuarias WHERE id = $1', [alumna.usuaria.id]);
  assert.ok(rows[0].bloqueada_en, 'en la BD queda la fecha del bloqueo');
});

test('el 3.er fallo responde igual que los demás (no revela que la cuenta existe ni que se bloqueó)', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const [primero, , tercero] = await fallar(alumna, 3);
  assert.equal(tercero.estado, 401);
  assert.equal(tercero.datos.error, primero.datos.error);
  assert.equal(tercero.datos.bloqueada, undefined);
});

test('con 2 fallos todavía puede entrar, y al acertar el contador vuelve a 0', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await fallar(alumna, 2);
  assert.equal((await entrar(alumna)).estado, 200);

  // Como el contador volvió a 0, otros 2 fallos tampoco la bloquean
  await fallar(alumna, 2);
  assert.equal((await entrar(alumna)).estado, 200);
});

test('al bloquearse se cierran sus sesiones abiertas (la API ya no la reconoce)', async () => {
  const alumna = await nuevaUsuaria('alumna'); // tiene una sesión abierta
  await fallar(alumna, 3);

  assert.equal((await alumna.get('/api/auth/yo')).datos, null);
  assert.equal((await alumna.get('/api/servicios')).estado, 401, 'ninguna ruta de la API la deja pasar');
});

test('al bloquearse le llega un correo de aviso', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await fallar(alumna, 3);
  assert.match(ultimoCorreo(alumna.usuaria.email).asunto, /bloqueado/);
});

test('recuperar la contraseña NO desbloquea la cuenta', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await fallar(alumna, 3);

  await new Sesion().post('/api/auth/recuperar', { email: alumna.usuaria.email });
  const token = tokenDelCorreo(ultimoCorreo(alumna.usuaria.email));
  const res = await new Sesion().post('/api/auth/restablecer', { token, password: 'nueva1234' });
  assert.equal(res.estado, 200);
  assert.equal(res.datos.bloqueada, true);

  assert.equal((await entrar(alumna, 'nueva1234')).estado, 423);
});

test('3 fallos de la contraseña actual en "Mi cuenta" también bloquean y cierran la sesión', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const datos = { actual: 'mala1234', nueva: 'nueva1234' };
  assert.equal((await alumna.post('/api/auth/cambiar-password', datos)).estado, 400);
  assert.equal((await alumna.post('/api/auth/cambiar-password', datos)).estado, 400);
  assert.equal((await alumna.post('/api/auth/cambiar-password', datos)).estado, 423);
  assert.equal((await alumna.get('/api/auth/yo')).datos, null);
});

test('solo la administradora ve y desbloquea cuentas (alumna → 403)', async () => {
  const bloqueada = await nuevaUsuaria('alumna');
  await fallar(bloqueada, 3);
  const otra = await nuevaUsuaria('alumna');

  assert.equal((await otra.get('/api/auth/bloqueadas')).estado, 403);
  const res = await otra.put(`/api/auth/bloqueadas/${bloqueada.usuaria.id}/desbloquear`);
  assert.equal(res.estado, 403);
  assert.equal((await entrar(bloqueada)).estado, 423, 'sigue bloqueada');
});

test('la administradora la ve en la lista, la desbloquea, y vuelve a poder entrar', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await fallar(alumna, 3);
  const admin = await sesionAdmin();

  const lista = await admin.get('/api/auth/bloqueadas');
  assert.ok(lista.datos.some(c => c.id === alumna.usuaria.id), 'aparece en la lista');

  const res = await admin.put(`/api/auth/bloqueadas/${alumna.usuaria.id}/desbloquear`);
  assert.equal(res.estado, 200);
  assert.match(ultimoCorreo(alumna.usuaria.email).asunto, /desbloqueada/);

  assert.equal((await entrar(alumna)).estado, 200);
  const despues = await admin.get('/api/auth/bloqueadas');
  assert.ok(!despues.datos.some(c => c.id === alumna.usuaria.id), 'ya no aparece en la lista');
});

test('desbloquear una cuenta que no está bloqueada → 404', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const admin = await sesionAdmin();
  assert.equal((await admin.put(`/api/auth/bloqueadas/${alumna.usuaria.id}/desbloquear`)).estado, 404);
});
