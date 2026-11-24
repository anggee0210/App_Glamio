// Calculadora "Calcular mi precio"
// Fórmula: (materiales + mano de obra) * (1 + margen/100)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sesion, nuevaUsuaria } = require('../ayudantes');

async function calcular(datos) {
  const res = await new Sesion().post('/api/servicios/calcular', datos);
  assert.equal(res.estado, 200);
  return res.datos.precio_sugerido;
}

test('materiales 5 € + 1 hora a 10 €/h + 50 % de margen = 22,50 €', async () => {
  const precio = await calcular({
    materiales: [{ nombre: 'Base', coste: 2 }, { nombre: 'Color', coste: 3 }],
    minutos: 60, precio_hora: 10, margen: 50
  });
  assert.equal(precio, 22.5);
});

test('sin margen, el precio es solo el coste', async () => {
  const precio = await calcular({ materiales: [{ nombre: 'Esmalte', coste: 4 }], minutos: 30, precio_hora: 12, margen: 0 });
  assert.equal(precio, 10); // 4 + 0,5 h × 12
});

test('redondea a 2 decimales', async () => {
  const precio = await calcular({ materiales: [{ nombre: 'Lima', coste: 1 }], minutos: 20, precio_hora: 10, margen: 0 });
  assert.equal(precio, 4.33); // 1 + 3,333…
});

test('RN-12: no acepta valores negativos ni materiales sin nombre → 400', async () => {
  const sesion = new Sesion();
  const negativo = await sesion.post('/api/servicios/calcular', { materiales: [], minutos: 60, precio_hora: -5, margen: 30 });
  assert.equal(negativo.estado, 400);
  const sinNombre = await sesion.post('/api/servicios/calcular', { materiales: [{ coste: 2 }], minutos: 60, precio_hora: 10, margen: 30 });
  assert.equal(sinNombre.estado, 400);
});

test('una profesional guarda un servicio y lo ve en "mis servicios"', async () => {
  const profesional = await nuevaUsuaria('profesional');
  const res = await profesional.post('/api/servicios', {
    nombre: 'Semipermanente manos', categoria_id: 1, curso_id: 2,
    minutos: 60, precio_hora: 10, margen: 50,
    materiales: [{ nombre: 'Base', coste: 2 }, { nombre: 'Color', coste: 3 }]
  });
  assert.equal(res.estado, 201);
  assert.equal(Number(res.datos.precio_sugerido), 22.5);

  const mios = await profesional.get('/api/servicios');
  assert.equal(mios.datos.length, 1);
  assert.equal(mios.datos[0].materiales.length, 2);
});
