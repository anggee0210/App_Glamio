// Pruebas de la ficha personal de la alumna (18/11)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sesion, nuevaUsuaria, sesionAdmin } = require('../ayudantes');

const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
let siguiente = 10000000;

// Un DNI válido y distinto cada vez (la letra se calcula igual que en el servidor)
function dniValido() {
  const n = siguiente++;
  return String(n) + LETRAS[n % 23];
}
// Un NIE válido: X + 7 cifras + letra (X cuenta como 0)
function nieValido() {
  const n = siguiente++ % 10000000;
  const cifras = String(n).padStart(7, '0');
  return 'X' + cifras + LETRAS[Number(cifras) % 23];
}
// Fecha de hace N años (AAAA-MM-DD)
function haceAnios(n, diasMas = 0) {
  const f = new Date();
  f.setFullYear(f.getFullYear() - n);
  f.setDate(f.getDate() + diasMas);
  // Con la fecha LOCAL (toISOString usa la hora UTC y a medianoche daría el día anterior)
  const dos = x => String(x).padStart(2, '0');
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
}
// Desde el 18/11 solo la administradora crea y modifica fichas: las pruebas guardan así
let adminGuarda = null;
async function guardar(alumna, ficha) {
  adminGuarda = adminGuarda || await sesionAdmin();
  const id = (await alumna.get('/api/auth/yo')).datos.id;
  return adminGuarda.put(`/api/ficha/alumnas/${id}/ficha`, ficha);
}
// Una ficha correcta de España; cada prueba cambia solo lo que quiere probar
function fichaBuena(cambios = {}) {
  return {
    nombre_completo: 'Ana María López Pérez',
    pais_nacimiento: 'ES',
    ciudad_nacimiento: 'Sevilla',
    numero_documento: dniValido(),
    fecha_nacimiento: '1995-05-10',
    direccion: 'Calle Mayor 12, 2º B, Madrid',
    telefono: '+34 600 111 222',
    ...cambios
  };
}

test('la lista de países sale para el formulario (España primero, Otro país al final)', async () => {
  const res = await new Sesion().get('/api/ficha/paises');
  assert.equal(res.estado, 200);
  assert.equal(res.datos[0].codigo, 'ES');
  assert.equal(res.datos.at(-1).codigo, 'XX');
  assert.equal(res.datos.at(-1).documento, 'Pasaporte');
  assert.ok(!('patron' in res.datos[0]), 'no hace falta mandar la expresión regular');
});

test('la alumna ya tiene la ficha que rellenó al registrarse; la administradora la cambia y ella la ve', async () => {
  const ana = await nuevaUsuaria('alumna');
  const delRegistro = (await ana.get('/api/ficha')).datos;
  assert.equal(delRegistro.nombre_completo, 'Prueba Alumna García', 'la ficha del registro (24/11)');

  const res = await guardar(ana, fichaBuena());
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal(res.datos.documento, 'DNI');
  assert.equal(res.datos.pais, 'España');
  assert.equal(res.datos.telefono, '+34600111222', 'el teléfono se guarda sin espacios');

  const otra = await ana.get('/api/ficha');
  assert.equal(otra.datos.nombre_completo, 'Ana María López Pérez');
  assert.equal(otra.datos.fecha_nacimiento, '1995-05-10');
});

test('el DNI se guarda limpio: "12.345.678-z" → "12345678Z"', async () => {
  const ana = await nuevaUsuaria('alumna');
  const dni = dniValido();
  const escrito = `${dni.slice(0, 2)}.${dni.slice(2, 5)}.${dni.slice(5, 8)}-${dni[8].toLowerCase()}`;
  const res = await guardar(ana, fichaBuena({ numero_documento: escrito }));
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal(res.datos.numero_documento, dni);
});

test('volver a guardar actualiza la ficha (no crea otra)', async () => {
  const ana = await nuevaUsuaria('alumna');
  await guardar(ana, fichaBuena());
  const res = await guardar(ana, fichaBuena({ direccion: 'Avenida Nueva 5, Valencia' }));
  assert.equal(res.estado, 200);
  assert.equal((await ana.get('/api/ficha')).datos.direccion, 'Avenida Nueva 5, Valencia');
});

test('DNI con la letra mal → 400', async () => {
  const ana = await nuevaUsuaria('alumna');
  const dni = dniValido();
  const letraMala = dni[8] === 'A' ? 'B' : 'A';
  const res = await guardar(ana, fichaBuena({ numero_documento: dni.slice(0, 8) + letraMala }));
  assert.equal(res.estado, 400);
  assert.match(res.datos.error, /letra del DNI/);
});

test('el documento depende del país: Colombia pide la cédula y no acepta un DNI', async () => {
  const eva = await nuevaUsuaria('alumna');
  const mal = await guardar(eva, fichaBuena({ pais_nacimiento: 'CO', numero_documento: dniValido() }));
  assert.equal(mal.estado, 400);
  assert.match(mal.datos.error, /Cédula de ciudadanía de Colombia/);

  const bien = await guardar(eva, fichaBuena({ pais_nacimiento: 'CO', numero_documento: '10' + siguiente++ }));
  assert.equal(bien.estado, 200, JSON.stringify(bien.datos));
  assert.equal(bien.datos.documento, 'Cédula de ciudadanía');
});

test('México pide la CURP y "Otro país" el pasaporte', async () => {
  const mx = await nuevaUsuaria('alumna');
  const res = await guardar(mx, fichaBuena({ pais_nacimiento: 'MX', numero_documento: 'GODE850101MDFRRL09' }));
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal(res.datos.documento, 'CURP');

  const otra = await nuevaUsuaria('alumna');
  const pas = await guardar(otra, fichaBuena({ pais_nacimiento: 'XX', numero_documento: 'PA' + siguiente++ }));
  assert.equal(pas.estado, 200, JSON.stringify(pas.datos));
  assert.equal(pas.datos.documento, 'Pasaporte');
});

test('nacida fuera de España puede dar su NIE (con la letra bien)', async () => {
  const lu = await nuevaUsuaria('alumna');
  const res = await guardar(lu, fichaBuena({ pais_nacimiento: 'VE', usa_nie: true, numero_documento: nieValido() }));
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal(res.datos.documento, 'NIE');
  assert.equal(res.datos.pais, 'Venezuela');

  const nie = nieValido();
  const letraMala = nie[8] === 'A' ? 'B' : 'A';
  const mal = await guardar(lu, fichaBuena({ pais_nacimiento: 'VE', usa_nie: true, numero_documento: nie.slice(0, 8) + letraMala }));
  assert.equal(mal.estado, 400);
  assert.match(mal.datos.error, /letra del NIE/);
});

test('nacida en España no puede usar NIE → 400', async () => {
  const ana = await nuevaUsuaria('alumna');
  const res = await guardar(ana, fichaBuena({ usa_nie: true, numero_documento: nieValido() }));
  assert.equal(res.estado, 400);
  assert.match(res.datos.error, /DNI/);
});

test('el mismo documento no puede estar en dos cuentas → 409', async () => {
  const dni = dniValido();
  const ana = await nuevaUsuaria('alumna');
  const eva = await nuevaUsuaria('alumna');
  assert.equal((await guardar(ana, fichaBuena({ numero_documento: dni }))).estado, 200);
  const res = await guardar(eva, fichaBuena({ numero_documento: dni }));
  assert.equal(res.estado, 409);
});

test('edad mínima 14 años: con 13 → 400; justo 14 → 200', async () => {
  const nina = await nuevaUsuaria('alumna');
  const res = await guardar(nina, fichaBuena({ fecha_nacimiento: haceAnios(14, 1) }));
  assert.equal(res.estado, 400);
  assert.match(res.datos.error, /14 años/);

  const ok = await guardar(nina, fichaBuena({ fecha_nacimiento: haceAnios(14) }));
  assert.equal(ok.estado, 200, JSON.stringify(ok.datos));
});

test('datos mal escritos → 400 con un mensaje claro', async () => {
  const ana = await nuevaUsuaria('alumna');
  const antes = (await ana.get('/api/ficha')).datos; // la del registro
  const casos = [
    [{ nombre_completo: 'Ana' }, /nombre/],
    [{ nombre_completo: 'Ana123 López' }, /letras/],
    [{ pais_nacimiento: 'ZZ' }, /país/],
    [{ ciudad_nacimiento: '' }, /ciudad/],
    [{ numero_documento: '' }, /documento/],
    [{ fecha_nacimiento: '2001-02-30' }, /fecha/],
    [{ fecha_nacimiento: '1850-01-01' }, /año/],
    [{ direccion: 'C/' }, /dirección/],
    [{ telefono: '600abc' }, /teléfono/],
    [{ telefono: '1234' }, /teléfono/]
  ];
  for (const [cambio, mensaje] of casos) {
    const res = await guardar(ana, fichaBuena(cambio));
    assert.equal(res.estado, 400, `${JSON.stringify(cambio)} debería dar 400`);
    assert.match(res.datos.error, mensaje);
  }
  assert.deepEqual((await ana.get('/api/ficha')).datos, antes, 'nada de eso se guardó');
});

test('solo la alumna tiene ficha: profesional y clienta → 403; sin sesión → 401', async () => {
  for (const perfil of ['profesional', 'clienta']) {
    const s = await nuevaUsuaria(perfil);
    assert.equal((await s.get('/api/ficha')).estado, 403);
    assert.equal((await s.put('/api/ficha', fichaBuena())).estado, 403);
  }
  assert.equal((await new Sesion().get('/api/ficha')).estado, 401);
});

test('la administradora ve todas las alumnas (con y sin ficha) y una ficha concreta', async () => {
  const conFicha = await nuevaUsuaria('alumna');
  await guardar(conFicha, fichaBuena());
  const sinFicha = await nuevaUsuaria('alumna');
  const admin = await sesionAdmin();
  // Desde el 24/11 toda alumna nueva trae ficha; "sin ficha" = cuentas antiguas o una que la
  // administradora ha borrado. Lo simulamos borrándola.
  const idSin = (await sinFicha.get('/api/auth/yo')).datos.id;
  assert.equal((await admin.pedir('DELETE', `/api/ficha/alumnas/${idSin}/ficha`)).estado, 200);

  const lista = await admin.get('/api/ficha/alumnas');
  assert.equal(lista.estado, 200);
  const a = lista.datos.find(x => x.email === conFicha.usuaria.email);
  const b = lista.datos.find(x => x.email === sinFicha.usuaria.email);
  assert.equal(a.tiene_ficha, true);
  assert.equal(a.documento, 'DNI');
  assert.equal(b.tiene_ficha, false);

  // Toda la información de una: cuenta + ficha + cursos + actividad (nunca la contraseña)
  const una = await admin.get(`/api/ficha/alumnas/${a.id}`);
  assert.equal(una.estado, 200);
  assert.equal(una.datos.ficha.nombre_completo, 'Ana María López Pérez');
  assert.equal(una.datos.cuenta.email, conFicha.usuaria.email);
  assert.ok(Array.isArray(una.datos.cursos));
  assert.equal(una.datos.actividad.trabajos, 0);
  assert.ok(!JSON.stringify(una.datos).includes('argon2'), 'sin la contraseña');

  const sin = await admin.get(`/api/ficha/alumnas/${b.id}`);
  assert.equal(sin.estado, 200);
  assert.equal(sin.datos.ficha, null, 'sin ficha: sale la cuenta, pero la ficha vacía');
  assert.equal((await admin.get('/api/ficha/alumnas/abc')).estado, 404);
});

test('la información de una alumna incluye sus cursos con las lecciones hechas', async () => {
  const ana = await nuevaUsuaria('alumna');
  await ana.post('/api/cursos/1/inscribirse', { pago_simulado: true });
  const curso = await ana.get('/api/cursos/1');
  await ana.post(`/api/lecciones/${curso.datos.lecciones[0].id}/completar`);
  const yo = (await ana.get('/api/auth/yo')).datos;

  const res = await (await sesionAdmin()).get(`/api/ficha/alumnas/${yo.id}`);
  const c = res.datos.cursos.find(x => x.id === 1);
  assert.ok(c, 'sale el curso');
  assert.equal(c.lecciones_hechas, 1);
  assert.equal(c.total_lecciones, curso.datos.lecciones.length);
});

test('la administradora corrige la ficha de una alumna (con las mismas comprobaciones)', async () => {
  const ana = await nuevaUsuaria('alumna');
  const yo = (await ana.get('/api/auth/yo')).datos;
  const admin = await sesionAdmin();

  // Puede rellenarla aunque la alumna no la tenga todavía
  const res = await admin.put(`/api/ficha/alumnas/${yo.id}/ficha`, fichaBuena({ telefono: '611222333' }));
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal((await ana.get('/api/ficha')).datos.telefono, '611222333', 'la alumna ve el cambio');

  const mal = await admin.put(`/api/ficha/alumnas/${yo.id}/ficha`, fichaBuena({ telefono: 'abc' }));
  assert.equal(mal.estado, 400);
  assert.equal((await admin.put('/api/ficha/alumnas/999999/ficha', fichaBuena())).estado, 404);
});

test('la administradora cambia el nombre y el email; con el email nuevo se entra', async () => {
  const ana = await nuevaUsuaria('alumna');
  const yo = (await ana.get('/api/auth/yo')).datos;
  const admin = await sesionAdmin();
  const nuevoEmail = 'Corregido.' + Date.now() + '@pruebas.glamio';

  const res = await admin.put(`/api/ficha/alumnas/${yo.id}/cuenta`, { nombre: '  Ana   Corregida ', email: nuevoEmail });
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal(res.datos.nombre, 'Ana Corregida');
  assert.equal(res.datos.email, nuevoEmail.toLowerCase(), 'el email se guarda en minúsculas');

  const entrar = await new Sesion().post('/api/auth/login', { email: nuevoEmail, password: ana.usuaria.password });
  assert.equal(entrar.estado, 200, 'entra con el email nuevo y su contraseña de siempre');

  // Email repetido → 409; email mal escrito → 400
  const otra = await nuevaUsuaria('alumna');
  assert.equal((await admin.put(`/api/ficha/alumnas/${yo.id}/cuenta`, { nombre: 'Ana', email: otra.usuaria.email })).estado, 409);
  assert.equal((await admin.put(`/api/ficha/alumnas/${yo.id}/cuenta`, { nombre: 'Ana', email: 'no-es-email' })).estado, 400);
});

test('borrar la ficha: se van los datos personales, la cuenta sigue', async () => {
  const ana = await nuevaUsuaria('alumna');
  await guardar(ana, fichaBuena());
  const yo = (await ana.get('/api/auth/yo')).datos;
  const admin = await sesionAdmin();

  assert.equal((await admin.pedir('DELETE', `/api/ficha/alumnas/${yo.id}/ficha`)).estado, 200);
  assert.equal((await ana.get('/api/ficha')).datos, null, 'ya no tiene ficha');
  assert.ok((await ana.get('/api/auth/yo')).datos, 'pero sigue dentro de su cuenta');
  assert.equal((await admin.pedir('DELETE', `/api/ficha/alumnas/${yo.id}/ficha`)).estado, 404, 'no hay nada que borrar');
});

test('borrar la cuenta: primero pide confirmar (409 con lo que se perdería) y luego la borra entera', async () => {
  const ana = await nuevaUsuaria('alumna');
  await guardar(ana, fichaBuena());
  await ana.post('/api/cursos/1/inscribirse', { pago_simulado: true });
  const yo = (await ana.get('/api/auth/yo')).datos;
  const admin = await sesionAdmin();

  const aviso = await admin.pedir('DELETE', `/api/ficha/alumnas/${yo.id}`);
  assert.equal(aviso.estado, 409);
  assert.equal(aviso.datos.perderia.cursos, 1);
  assert.ok((await ana.get('/api/auth/yo')).datos, 'sin confirmar no se borra nada');

  const res = await admin.pedir('DELETE', `/api/ficha/alumnas/${yo.id}?confirmar=si`);
  assert.equal(res.estado, 200, JSON.stringify(res.datos));
  assert.equal((await ana.get('/api/auth/yo')).datos, null, 'su sesión deja de valer');
  const entrar = await new Sesion().post('/api/auth/login', { email: ana.usuaria.email, password: ana.usuaria.password });
  assert.notEqual(entrar.estado, 200, 'ya no puede entrar');
  assert.equal((await admin.get(`/api/ficha/alumnas/${yo.id}`)).estado, 404);
});

test('solo se borran alumnas: la cuenta de una profesional o de la admin → 404', async () => {
  const pro = await nuevaUsuaria('profesional');
  const idPro = (await pro.get('/api/auth/yo')).datos.id;
  const admin = await sesionAdmin();
  const idAdmin = (await admin.get('/api/auth/yo')).datos.id;
  assert.equal((await admin.pedir('DELETE', `/api/ficha/alumnas/${idPro}?confirmar=si`)).estado, 404);
  assert.equal((await admin.pedir('DELETE', `/api/ficha/alumnas/${idAdmin}?confirmar=si`)).estado, 404);
  assert.ok((await pro.get('/api/auth/yo')).datos, 'la profesional sigue');
});

test('una alumna NO puede modificar ni borrar a otras → 403', async () => {
  const ana = await nuevaUsuaria('alumna');
  const eva = await nuevaUsuaria('alumna');
  const idEva = (await eva.get('/api/auth/yo')).datos.id;
  assert.equal((await ana.put(`/api/ficha/alumnas/${idEva}/ficha`, fichaBuena())).estado, 403);
  assert.equal((await ana.put(`/api/ficha/alumnas/${idEva}/cuenta`, { nombre: 'X Y', email: 'x@y.es' })).estado, 403);
  assert.equal((await ana.pedir('DELETE', `/api/ficha/alumnas/${idEva}/ficha`)).estado, 403);
  assert.equal((await ana.pedir('DELETE', `/api/ficha/alumnas/${idEva}?confirmar=si`)).estado, 403);
  assert.ok((await eva.get('/api/auth/yo')).datos, 'Eva sigue');
});

test('una alumna NO puede ver las fichas de las demás → 403', async () => {
  const ana = await nuevaUsuaria('alumna');
  assert.equal((await ana.get('/api/ficha/alumnas')).estado, 403);
  assert.equal((await ana.get('/api/ficha/alumnas/1')).estado, 403);
});

test('la ficha nunca sale en el perfil público', async () => {
  const ana = await nuevaUsuaria('alumna');
  const ficha = fichaBuena();
  await guardar(ana, ficha);
  const yo = await ana.get('/api/auth/yo');
  const perfil = await new Sesion().get(`/api/perfil/${yo.datos.id}`);
  assert.equal(perfil.estado, 200);
  const texto = JSON.stringify(perfil.datos);
  assert.ok(!texto.includes(ficha.numero_documento), 'sin documento');
  assert.ok(!texto.includes('600111222'), 'sin teléfono');
  assert.ok(!texto.includes('Calle Mayor'), 'sin dirección');
});

test('la alumna VE su ficha pero NO puede crearla ni modificarla → 403', async () => {
  const ana = await nuevaUsuaria('alumna');
  const delRegistro = (await ana.get('/api/ficha')).datos;
  const intento = await ana.put('/api/ficha', fichaBuena());
  assert.equal(intento.estado, 403);
  assert.match(intento.datos.error, /administradora/);
  assert.deepEqual((await ana.get('/api/ficha')).datos, delRegistro, 'no cambió nada');

  await guardar(ana, fichaBuena({ direccion: 'Calle Original 1, Madrid' }));
  const cambio = await ana.put('/api/ficha', fichaBuena({ direccion: 'Calle Cambiada 2, Madrid' }));
  assert.equal(cambio.estado, 403);
  const vista = await ana.get('/api/ficha');
  assert.equal(vista.estado, 200, 'sí puede verla');
  assert.equal(vista.datos.direccion, 'Calle Original 1, Madrid', 'sigue igual');
});

// ---------- Historial de dudas en la ficha de cada alumna (24/11) ----------

test('la ficha de cada alumna trae SOLO sus dudas (no las de otras), con respuestas y destacada', async () => {
  const ana = await nuevaUsuaria('alumna');
  const eva = await nuevaUsuaria('alumna');
  const admin = await sesionAdmin();
  await ana.post('/api/cursos/1/inscribirse');
  await eva.post('/api/cursos/1/inscribirse');

  const d1 = await ana.post('/api/dudas', { leccion_id: 1, texto: 'Duda de Ana 1' });
  const d2 = await ana.post('/api/dudas', { leccion_id: 1, texto: 'Duda de Ana 2' });
  await eva.post('/api/dudas', { leccion_id: 1, texto: 'Duda de Eva' });
  assert.equal(d1.estado, 201, JSON.stringify(d1.datos));

  // La administradora responde la primera de Ana y la marca como destacada
  const r = await admin.post(`/api/dudas/${d1.datos.id}/respuestas`, { texto: 'Respuesta' });
  await admin.put(`/api/dudas/respuestas/${r.datos.id}/destacar`);

  const idAna = (await ana.get('/api/auth/yo')).datos.id;
  const { datos } = await admin.get(`/api/ficha/alumnas/${idAna}`);
  assert.deepEqual(datos.dudas.map(d => d.texto).sort(), ['Duda de Ana 1', 'Duda de Ana 2'], 'solo las suyas');
  const primera = datos.dudas.find(d => d.id === d1.datos.id);
  assert.equal(primera.respuestas, 1);
  assert.equal(primera.con_destacada, true);
  assert.ok(primera.curso && primera.leccion, 'con su curso y su lección');
  const segunda = datos.dudas.find(d => d.id === d2.datos.id);
  assert.equal(segunda.respuestas, 0);
  assert.equal(segunda.con_destacada, false);

  const idEva = (await eva.get('/api/auth/yo')).datos.id;
  const deEva = (await admin.get(`/api/ficha/alumnas/${idEva}`)).datos.dudas;
  assert.deepEqual(deEva.map(d => d.texto), ['Duda de Eva']);
});
