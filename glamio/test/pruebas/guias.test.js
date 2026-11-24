// Guías teóricas en PDF: vista previa (?ver=1) y descarga
// La vista previa se abre en el visor del navegador (inline); la descarga baja el archivo (attachment).
// La vista previa es SOLO para la administradora; la descarga, para ella y para quien compró la guía.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { URL_BASE } = require('../config');
const { sesionAdmin, nuevaUsuaria } = require('../ayudantes');

// Un PDF mínimo (basta con que empiece por %PDF para la prueba)
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

// Petición "en bruto" con la cookie de la sesión (para subir archivos y leer cabeceras)
function pedir(sesion, metodo, url, cuerpo) {
  return fetch(URL_BASE + url, { method: metodo, body: cuerpo, headers: sesion.cookie ? { Cookie: sesion.cookie } : {} });
}

test('vista previa y descarga de una guía', async () => {
  const admin = await sesionAdmin();

  // La administradora sube una guía de prueba al curso 2
  const datos = new FormData();
  datos.append('curso_id', '2');
  datos.append('titulo', 'Guía de prueba');
  datos.append('precio', '5');
  datos.append('archivo', new Blob([PDF], { type: 'application/pdf' }), 'prueba.pdf');
  const subida = await pedir(admin, 'POST', '/api/guias', datos);
  assert.equal(subida.status, 201);
  const guia = await subida.json();

  try {
    // ?ver=1 → el PDF para verlo en el navegador
    const vista = await pedir(admin, 'GET', `/api/guias/${guia.id}/descargar?ver=1`);
    assert.equal(vista.status, 200);
    assert.match(vista.headers.get('content-type'), /application\/pdf/);
    assert.match(vista.headers.get('content-disposition'), /^inline/);
    assert.equal((await vista.arrayBuffer()).byteLength, PDF.length);

    // Sin ?ver → descarga normal
    const descarga = await pedir(admin, 'GET', `/api/guias/${guia.id}/descargar`);
    assert.equal(descarga.status, 200);
    assert.match(descarga.headers.get('content-disposition'), /^attachment/);

    // Una alumna que no la compró no puede descargarla
    const alumna = await nuevaUsuaria('alumna');
    const sinCompra = await pedir(alumna, 'GET', `/api/guias/${guia.id}/descargar`);
    assert.equal(sinCompra.status, 403);

    // Aunque la compre, la vista previa es SOLO para la administradora; ella la descarga
    const compra = await alumna.post(`/api/guias/${guia.id}/comprar`, { pago_simulado: true });
    assert.ok([200, 201].includes(compra.estado), JSON.stringify(compra.datos));
    const vistaAlumna = await pedir(alumna, 'GET', `/api/guias/${guia.id}/descargar?ver=1`);
    assert.equal(vistaAlumna.status, 403);
    const descargaAlumna = await pedir(alumna, 'GET', `/api/guias/${guia.id}/descargar`);
    assert.equal(descargaAlumna.status, 200);
  } finally {
    // Limpieza: se borra la guía de prueba (y su PDF)
    await pedir(admin, 'DELETE', `/api/guias/${guia.id}`);
  }
});
