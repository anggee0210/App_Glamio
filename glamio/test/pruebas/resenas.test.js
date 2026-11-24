// Reglas de reseñas:
// - solo se reseña un curso terminado
// - una reseña por alumna y curso
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nuevaUsuaria, terminarCurso } = require('../ayudantes');

const resena = { curso_id: 1, estrellas: 5, comentario: '¡Me encantó!' };

test('sin estar inscrita NO puede reseñar → 403', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const res = await alumna.post('/api/resenas', resena);
  assert.equal(res.estado, 403);
});

test('inscrita pero sin terminar NO puede reseñar → 403', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await alumna.post('/api/cursos/1/inscribirse');
  const res = await alumna.post('/api/resenas', resena);
  assert.equal(res.estado, 403);
});

test('al completar todas las lecciones el curso queda terminado y tiene certificado', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const ultima = await terminarCurso(alumna, 1);
  assert.equal(ultima.datos.terminado, true);

  const progreso = await alumna.get('/api/cursos/1/progreso');
  assert.equal(progreso.datos.porcentaje, 100);

  const certificado = await alumna.get('/api/cursos/1/certificado');
  assert.equal(certificado.estado, 200);
});

test('con el curso terminado SÍ puede reseñar, pero solo una vez (RN-19 → 409)', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await terminarCurso(alumna, 1);

  const primera = await alumna.post('/api/resenas', resena);
  assert.equal(primera.estado, 201);

  const segunda = await alumna.post('/api/resenas', { ...resena, comentario: 'Otra vez' });
  assert.equal(segunda.estado, 409); // 409 "conflicto", como dice reglas-de-negocio.md
});

test('RN-20: las estrellas tienen que ser de 1 a 5', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await terminarCurso(alumna, 1);
  const res = await alumna.post('/api/resenas', { ...resena, estrellas: 7 });
  assert.equal(res.estado, 400);
});

test('una clienta NO puede reseñar cursos → 403', async () => {
  const clienta = await nuevaUsuaria('clienta');
  const res = await clienta.post('/api/resenas', resena);
  assert.equal(res.estado, 403);
});

test('la reseña aparece con la insignia "Alumna certificada"', async () => {
  const alumna = await nuevaUsuaria('alumna');
  await terminarCurso(alumna, 1);
  await alumna.post('/api/resenas', resena);

  const lista = await alumna.get('/api/resenas?curso=1');
  const mia = lista.datos.find(r => r.usuaria_id === alumna.usuaria.id);
  assert.ok(mia, 'la reseña debería aparecer en la lista');
  assert.equal(mia.insignia, 'Alumna certificada');
});
