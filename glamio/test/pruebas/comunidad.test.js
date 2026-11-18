// Comunidad: dudas, respuestas y una sola respuesta destacada por duda
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nuevaUsuaria, sesionAdmin } = require('../ayudantes');

test('solo puede haber UNA respuesta destacada por duda, y sale la primera', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const profesional = await nuevaUsuaria('profesional');
  const admin = await sesionAdmin();

  // RN-14: solo participan en las dudas las inscritas en el curso (y la administradora)
  await alumna.post('/api/cursos/1/inscribirse');
  await profesional.post('/api/cursos/1/inscribirse');

  // La alumna pregunta en la lección 1
  const duda = await alumna.post('/api/dudas', { leccion_id: 1, texto: '¿Cuántas capas de base?' });
  assert.equal(duda.estado, 201);

  // Dos respuestas
  const r1 = await profesional.post(`/api/dudas/${duda.datos.id}/respuestas`, { texto: 'Una capa fina' });
  const r2 = await admin.post(`/api/dudas/${duda.datos.id}/respuestas`, { texto: 'Una fina y cura 60 s' });

  // La admin destaca primero r1 y luego cambia de idea y destaca r2
  await admin.put(`/api/dudas/respuestas/${r1.datos.id}/destacar`);
  await admin.put(`/api/dudas/respuestas/${r2.datos.id}/destacar`);

  const lista = await alumna.get('/api/dudas?leccion=1');
  const mia = lista.datos.find(d => d.id === duda.datos.id);
  const destacadas = mia.respuestas.filter(r => r.destacada);
  assert.equal(destacadas.length, 1);
  assert.equal(mia.respuestas[0].id, r2.datos.id, 'la destacada debe salir la primera');
});

test('RN-14: sin estar inscrita en el curso NO puede preguntar en sus lecciones → 403', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const res = await alumna.post('/api/dudas', { leccion_id: 1, texto: '¿Puedo preguntar?' });
  assert.equal(res.estado, 403);
});

test('una clienta NO puede preguntar en las lecciones → 403', async () => {
  const clienta = await nuevaUsuaria('clienta');
  const res = await clienta.post('/api/dudas', { leccion_id: 1, texto: 'Hola' });
  assert.equal(res.estado, 403);
});
