// Pruebas de "Mi cuenta": sesiones abiertas, cerrar todas y cambio de contraseña (flujos 4 y 5)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sesion, nuevaUsuaria, ultimoCorreo } = require('../ayudantes');

// Abre otra sesión de la misma usuaria (como si entrara desde el móvil)
async function otroDispositivo(sesion) {
  const movil = new Sesion();
  await movil.post('/api/auth/login', { email: sesion.usuaria.email, password: sesion.usuaria.password });
  return movil;
}

// ---------- 4. SESIONES ABIERTAS ----------

test('lista de sesiones abiertas: ve las dos y sabe cuál es la actual', async () => {
  const ordenador = await nuevaUsuaria('alumna');
  await otroDispositivo(ordenador);

  const res = await ordenador.get('/api/auth/sesiones');
  assert.equal(res.estado, 200);
  assert.equal(res.datos.length, 2);
  assert.equal(res.datos.filter(s => s.actual).length, 1);
});

test('cerrar UNA sesión concreta (la del móvil)', async () => {
  const ordenador = await nuevaUsuaria('alumna');
  const movil = await otroDispositivo(ordenador);

  const lista = await ordenador.get('/api/auth/sesiones');
  const laDelMovil = lista.datos.find(s => !s.actual);
  const res = await ordenador.pedir('DELETE', `/api/auth/sesiones/${laDelMovil.id}`);
  assert.equal(res.estado, 200);

  assert.equal((await movil.get('/api/auth/yo')).datos, null, 'el móvil queda fuera');
  assert.ok((await ordenador.get('/api/auth/yo')).datos, 'el ordenador sigue dentro');
});

test('no puede cerrar sesiones de otra usuaria → 404', async () => {
  const ana = await nuevaUsuaria('alumna');
  const eva = await nuevaUsuaria('alumna');
  const deEva = (await eva.get('/api/auth/sesiones')).datos[0];

  const res = await ana.pedir('DELETE', `/api/auth/sesiones/${deEva.id}`);
  assert.equal(res.estado, 404);
  assert.ok((await eva.get('/api/auth/yo')).datos, 'Eva sigue dentro');
});

test('cerrar todas: los demás dispositivos quedan fuera y este sigue dentro con sesión nueva', async () => {
  const ordenador = await nuevaUsuaria('alumna');
  const movil = await otroDispositivo(ordenador);
  const cookieVieja = ordenador.cookie;

  const res = await ordenador.post('/api/auth/cerrar-todas');
  assert.equal(res.estado, 200);
  assert.notEqual(ordenador.cookie, cookieVieja, 'este dispositivo recibe una sesión nueva');

  assert.equal((await movil.get('/api/auth/yo')).datos, null);
  assert.ok((await ordenador.get('/api/auth/yo')).datos);
  assert.equal((await ordenador.get('/api/auth/sesiones')).datos.length, 1);
});

// ---------- 5. CAMBIO DE CONTRASEÑA ----------

test('cambio de contraseña: pide la actual aunque haya sesión', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const res = await sesion.post('/api/auth/cambiar-password', { actual: 'mala1234', nueva: 'nueva1234' });
  assert.equal(res.estado, 400);
});

test('cambio de contraseña: la nueva debe cumplir la política', async () => {
  const sesion = await nuevaUsuaria('alumna');
  const res = await sesion.post('/api/auth/cambiar-password', { actual: sesion.usuaria.password, nueva: 'corta' });
  assert.equal(res.estado, 400);
});

test('cambio de contraseña: cierra las demás sesiones, avisa por correo y la nueva funciona', async () => {
  const ordenador = await nuevaUsuaria('alumna');
  const movil = await otroDispositivo(ordenador);

  const res = await ordenador.post('/api/auth/cambiar-password',
    { actual: ordenador.usuaria.password, nueva: 'nueva1234' });
  assert.equal(res.estado, 200);

  assert.equal((await movil.get('/api/auth/yo')).datos, null, 'el móvil queda fuera');
  assert.ok((await ordenador.get('/api/auth/yo')).datos, 'este dispositivo sigue dentro');
  assert.match(ultimoCorreo(ordenador.usuaria.email).asunto, /contraseña .* ha cambiado/);

  const vieja = await new Sesion().post('/api/auth/login', { email: ordenador.usuaria.email, password: ordenador.usuaria.password });
  assert.equal(vieja.estado, 401);
  const nueva = await new Sesion().post('/api/auth/login', { email: ordenador.usuaria.email, password: 'nueva1234' });
  assert.equal(nueva.estado, 200);
});
