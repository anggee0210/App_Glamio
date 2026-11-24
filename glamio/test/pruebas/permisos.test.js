// Regla: solo la administradora crea cursos y marca respuestas destacadas.
// Además, cada perfil solo puede hacer lo suyo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nuevaUsuaria, sesionAdmin } = require('../ayudantes');

const cursoNuevo = { titulo: 'Curso de prueba', descripcion: 'Creado por el harness', precio: 0, categoria_id: 1 };

test('la administradora SÍ puede crear cursos', async () => {
  const admin = await sesionAdmin();
  const res = await admin.post('/api/cursos', cursoNuevo);
  assert.equal(res.estado, 201);
  assert.equal(res.datos.titulo, cursoNuevo.titulo);
});

for (const perfil of ['alumna', 'profesional', 'clienta']) {
  test(`una ${perfil} NO puede crear cursos → 403`, async () => {
    const sesion = await nuevaUsuaria(perfil);
    const res = await sesion.post('/api/cursos', cursoNuevo);
    assert.equal(res.estado, 403);
  });
}

test('una alumna NO puede marcar una respuesta como destacada → 403', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const res = await alumna.put('/api/dudas/respuestas/1/destacar');
  assert.equal(res.estado, 403);
});

test('una clienta NO puede inscribirse en cursos → 403', async () => {
  const clienta = await nuevaUsuaria('clienta');
  const res = await clienta.post('/api/cursos/1/inscribirse');
  assert.equal(res.estado, 403);
});

test('una clienta NO puede usar sus servicios de la calculadora → 403', async () => {
  const clienta = await nuevaUsuaria('clienta');
  const res = await clienta.get('/api/servicios');
  assert.equal(res.estado, 403);
});

test('curso de pago: sin confirmar el pago simulado no se inscribe → 400', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const res = await alumna.post('/api/cursos/2/inscribirse'); // curso 2 cuesta 19,99 €
  assert.equal(res.estado, 400);

  const pagado = await alumna.post('/api/cursos/2/inscribirse', { pago_simulado: true });
  assert.equal(pagado.estado, 201);
});
