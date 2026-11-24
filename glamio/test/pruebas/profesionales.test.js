// Pruebas de la profesional (25/11): ficha personal + «Mi negocio» al registrarse,
// editar «Mi negocio», el directorio público y lo que ve la administradora.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../db/pool');
const { Sesion, nuevaUsuaria, sesionAdmin, emailUnico, fichaDePrueba, negocioDePrueba } = require('../ayudantes');

test.after(() => pool.end());

const idDe = async (s) => (await s.get('/api/auth/yo')).datos.id;

test('registro de profesional SIN «Mi negocio» → 400 y no se crea la cuenta', async () => {
  const email = emailUnico('pro-sin-negocio');
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Pro', email, password: 'clave1234', perfil: 'profesional', ficha: fichaDePrueba() });
  assert.equal(res.estado, 400);
  assert.match(res.datos.error, /ciudad/);
  assert.equal((await pool.query('SELECT 1 FROM usuarias WHERE email = $1', [email])).rows.length, 0);
});

test('registro de profesional SIN ficha personal → 400 (también es obligatoria)', async () => {
  const res = await new Sesion().post('/api/auth/registro',
    { nombre: 'Pro', email: emailUnico('pro-sin-ficha'), password: 'clave1234', perfil: 'profesional', negocio: negocioDePrueba() });
  assert.equal(res.estado, 400);
});

test('«Mi negocio» mal: sin especialidad, especialidad inexistente, años raros o Instagram con espacios → 400', async () => {
  for (const cambio of [{ especialidades: [] }, { especialidades: [9999] }, { anios_experiencia: 80 }, { instagram: 'mi cuenta' }, { ciudad: '' }]) {
    const res = await new Sesion().post('/api/auth/registro',
      { nombre: 'Pro', email: emailUnico('pro-mal'), password: 'clave1234', perfil: 'profesional',
        ficha: fichaDePrueba(), negocio: negocioDePrueba(cambio) });
    assert.equal(res.estado, 400, JSON.stringify(cambio));
  }
});

test('la profesional ve y edita su «Mi negocio»; el Instagram se guarda sin @ ni enlace', async () => {
  const pro = await nuevaUsuaria('profesional');
  const mio = await pro.get('/api/profesionales/mio');
  assert.equal(mio.estado, 200);
  assert.equal(mio.datos.ciudad, 'Madrid');
  assert.deepEqual(mio.datos.especialidades, [1]);

  const cambio = await pro.put('/api/profesionales/mio',
    negocioDePrueba({ ciudad: 'Sevilla', instagram: 'https://instagram.com/mi.salon/', a_domicilio: true, nombre_negocio: 'Salón Lila' }));
  assert.equal(cambio.estado, 200, JSON.stringify(cambio.datos));
  assert.equal(cambio.datos.ciudad, 'Sevilla');
  assert.equal(cambio.datos.instagram, 'mi.salon');
  assert.equal(cambio.datos.a_domicilio, true);
  assert.equal(cambio.datos.especialidades_nombres[0].id, 1);
});

test('solo la profesional tiene «Mi negocio»: alumna y clienta → 403; sin sesión → 401', async () => {
  for (const perfil of ['alumna', 'clienta']) {
    const s = await nuevaUsuaria(perfil);
    assert.equal((await s.get('/api/profesionales/mio')).estado, 403, perfil);
    assert.equal((await s.put('/api/profesionales/mio', negocioDePrueba())).estado, 403, perfil);
  }
  assert.equal((await new Sesion().get('/api/profesionales/mio')).estado, 401);
});

test('directorio público: sale con su ciudad y especialidades, filtra por ciudad y categoría, sin datos personales', async () => {
  const pro = await nuevaUsuaria('profesional');
  const ciudad = 'Ciudad' + Date.now();
  await pro.put('/api/profesionales/mio', negocioDePrueba({ ciudad, especialidades: [1] }));
  const id = await idDe(pro);

  const todas = await new Sesion().get('/api/profesionales');
  assert.equal(todas.estado, 200);
  const yo = todas.datos.find(p => p.id === id);
  assert.ok(yo, 'sale en el directorio');
  assert.equal(yo.ciudad, ciudad);
  const texto = JSON.stringify(todas.datos);
  assert.ok(!texto.includes('numero_documento') && !texto.includes('@pruebas'), 'ni documento ni email');

  const enSuCiudad = await new Sesion().get('/api/profesionales?ciudad=' + ciudad.toLowerCase());
  assert.deepEqual(enSuCiudad.datos.map(p => p.id), [id]);
  const otraCategoria = await new Sesion().get(`/api/profesionales?ciudad=${ciudad}&categoria=99999`);
  assert.equal(otraCategoria.datos.length, 0);
});

test('perfil público de la profesional: trae su negocio; el de la alumna, no', async () => {
  const pro = await nuevaUsuaria('profesional');
  const perfil = await new Sesion().get('/api/perfil/' + await idDe(pro));
  assert.equal(perfil.datos.negocio.ciudad, 'Madrid');
  assert.ok(!JSON.stringify(perfil.datos).includes('numero_documento'));
  const alumna = await nuevaUsuaria('alumna');
  assert.equal((await new Sesion().get('/api/perfil/' + await idDe(alumna))).datos.negocio, null);
});

test('la administradora ve a las profesionales en el Panel: su ficha y su negocio', async () => {
  const pro = await nuevaUsuaria('profesional');
  const id = await idDe(pro);
  const admin = await sesionAdmin();
  const lista = await admin.get('/api/ficha/alumnas?perfil=profesional');
  assert.ok(lista.datos.some(p => p.id === id && p.tiene_ficha));
  assert.ok(!(await admin.get('/api/ficha/alumnas')).datos.some(p => p.id === id), 'no sale entre las alumnas');
  const una = await admin.get('/api/ficha/alumnas/' + id);
  assert.equal(una.estado, 200);
  assert.equal(una.datos.cuenta.perfil, 'profesional');
  assert.equal(una.datos.negocio.ciudad, 'Madrid');
  assert.ok(una.datos.ficha.numero_documento);
});
