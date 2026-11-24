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

// ---------- Precio del producto ÷ servicios que salen (24/11) ----------

test('esmalte de 12 € que da para 30 servicios → 0,40 € por sesión; con 1 h a 10 €/h y 0 % = 10,40 €', async () => {
  const res = await new Sesion().post('/api/servicios/calcular', {
    materiales: [{ nombre: 'Esmalte', precio_envase: 12, servicios_envase: 30 }],
    minutos: 60, precio_hora: 10, margen: 0
  });
  assert.equal(res.estado, 200);
  assert.equal(res.datos.coste_materiales, 0.4);
  assert.equal(res.datos.mano_obra, 10);
  assert.equal(res.datos.margen_euros, 0);
  assert.equal(res.datos.precio_sugerido, 10.4);
});

test('el desglose suma el precio: materiales + tiempo + margen', async () => {
  const res = await new Sesion().post('/api/servicios/calcular', {
    materiales: [
      { nombre: 'Base', precio_envase: 9, servicios_envase: 45 },   // 0,20
      { nombre: 'Lima', precio_envase: 3, servicios_envase: 10 }    // 0,30
    ],
    minutos: 30, precio_hora: 12, margen: 50                      // tiempo 6 → (0,5 + 6) × 1,5 = 9,75
  });
  assert.equal(res.datos.coste_materiales, 0.5);
  assert.equal(res.datos.mano_obra, 6);
  assert.equal(res.datos.margen_euros, 3.25);
  assert.equal(res.datos.precio_sugerido, 9.75);
});

test('servicios que salen: 0, decimales o vacío → 400; precio negativo → 400', async () => {
  const s = new Sesion();
  for (const servicios_envase of [0, 2.5, '', -3, 'muchos']) {
    const res = await s.post('/api/servicios/calcular', {
      materiales: [{ nombre: 'Gel', precio_envase: 10, servicios_envase }], minutos: 60, precio_hora: 10, margen: 0 });
    assert.equal(res.estado, 400, `servicios_envase=${JSON.stringify(servicios_envase)} debería dar 400`);
  }
  const negativo = await s.post('/api/servicios/calcular', {
    materiales: [{ nombre: 'Gel', precio_envase: -1, servicios_envase: 5 }], minutos: 60, precio_hora: 10, margen: 0 });
  assert.equal(negativo.estado, 400);
});

test('al guardar se apuntan el precio del producto, los servicios y el coste por sesión (sin redondear a 0,00)', async () => {
  const alumna = await nuevaUsuaria('alumna');
  const res = await alumna.post('/api/servicios', {
    nombre: 'Manicura rápida', categoria_id: 1, minutos: 60, precio_hora: 10, margen: 0,
    materiales: [{ nombre: 'Algodón', precio_envase: 5, servicios_envase: 300 }]  // 0,0167 € por sesión
  });
  assert.equal(res.estado, 201, JSON.stringify(res.datos));
  assert.equal(Number(res.datos.precio_sugerido), 10.02);
  const [servicio] = (await alumna.get('/api/servicios')).datos;
  const [m] = servicio.materiales;
  assert.equal(Number(m.precio_envase), 5);
  assert.equal(m.servicios_envase, 300);
  assert.equal(Number(m.coste), 0.0167, 'el coste por sesión se guarda con 4 decimales');
});
