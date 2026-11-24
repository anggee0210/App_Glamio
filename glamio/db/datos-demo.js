// =========================================
// GLAMIO – Datos para la DEMO de la presentación
// Uso:  npm run db:demo            (contraseña de las cuentas demo: Demo2026)
//       node db/datos-demo.js OtraClave1   (si quieres otra contraseña)
//
// Crea 5 cuentas de prueba y les da "vida" para enseñar la app sin empezar de cero:
//   · Lucía  (alumna)      → curso terminado, certificado, reseña, duda con respuesta destacada, trabajo en el muro
//   · Marta  (alumna)      → curso a medias (no puede reseñar) y una duda SIN responder (para responderla en directo)
//   · Sofía  (profesional) → trabajo en el muro y un servicio guardado en la calculadora (público en su perfil)
//   · Carmen (clienta)     → un favorito en Mi Estilo
//   · Bea    (alumna)      → cuenta BLOQUEADA tras 3 fallos (para desbloquearla desde el Panel)
//
// ✔ NO toca tus datos: solo las cuentas que terminan en ".demo@example.com".
//   example.com es un dominio reservado: ningún correo llega a nadie de verdad.
// ✔ Se puede ejecutar todas las veces que quieras: primero borra las cuentas demo
//   (ON DELETE CASCADE se lleva todo lo suyo) y las vuelve a crear limpias.
//   Útil justo antes de presentar, para dejarlo todo como al principio.
// ✔ Necesita que ya existan la administradora y al menos 2 cursos con lecciones.
// =========================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { cifrarPassword } = require('../middleware/contrasenas'); // Argon2id, como el registro
const { errorPassword } = require('../middleware/seguridad');

const PASSWORD = process.argv[2] || 'Demo2026';
const DOMINIO_DEMO = '.demo@example.com';

// Las cuentas de la demo
const CUENTAS = {
  lucia:  { nombre: 'Lucía Martín', email: 'lucia'  + DOMINIO_DEMO, perfil: 'alumna' },
  marta:  { nombre: 'Marta Gómez',  email: 'marta'  + DOMINIO_DEMO, perfil: 'alumna' },
  sofia:  { nombre: 'Sofía Ruiz',   email: 'sofia'  + DOMINIO_DEMO, perfil: 'profesional' },
  carmen: { nombre: 'Carmen López', email: 'carmen' + DOMINIO_DEMO, perfil: 'clienta' },
  bea:    { nombre: 'Bea Torres',   email: 'bea'    + DOMINIO_DEMO, perfil: 'alumna' }
};

// Misma fórmula que la calculadora (routes/servicios.js)
function calcularPrecio(materiales, minutos, precioHora, margen) {
  const costeMateriales = materiales.reduce((suma, m) => suma + Number(m.coste || 0), 0);
  const manoObra = (Number(minutos) / 60) * Number(precioHora);
  const total = (costeMateriales + manoObra) * (1 + Number(margen) / 100);
  return Math.round(total * 100) / 100;
}

// Copia una foto de ejemplo a uploads/imagenes/demo-*.jpg para usarla en el muro.
// Se usa una COPIA: si en la demo borras el trabajo, se borra la copia y no la portada del curso.
function fotoDemo(nombreDestino, candidatas) {
  const raiz = path.join(__dirname, '..');
  const origen = candidatas.map(r => path.join(raiz, r)).find(r => fs.existsSync(r));
  if (!origen) return null;
  fs.copyFileSync(origen, path.join(raiz, 'uploads', 'imagenes', nombreDestino));
  return `/uploads/imagenes/${nombreDestino}`;
}

// Elige los dos cursos de la demo entre los que ya hay (prefiere Uñas, la categoría principal)
async function elegirCursos(bd) {
  const { rows } = await bd.query(
    `SELECT c.id, c.titulo, c.precio, c.categoria_id, cat.nombre AS categoria,
            (SELECT COUNT(*) FROM lecciones l WHERE l.curso_id = c.id)::int AS lecciones
       FROM cursos c JOIN categorias cat ON cat.id = c.categoria_id
      ORDER BY (cat.nombre = 'Uñas') DESC, c.id`);
  const conLecciones = rows.filter(c => c.lecciones > 0);
  if (conLecciones.length < 2) {
    throw new Error('Hacen falta al menos 2 cursos con lecciones (ejecuta antes db/seed.sql o créalos en el Panel)');
  }
  const terminado = conLecciones[0];
  // El curso "a medias" mejor con 2 o más lecciones, para que se vea el progreso parcial
  const aMedias = conLecciones.slice(1).find(c => c.lecciones >= 2) || conLecciones[1];
  return { terminado, aMedias };
}

async function leccionesDe(bd, cursoId) {
  const { rows } = await bd.query('SELECT id, titulo FROM lecciones WHERE curso_id = $1 ORDER BY orden, id', [cursoId]);
  return rows;
}

async function crearDemo() {
  const errorClave = errorPassword(PASSWORD);
  if (errorClave) throw new Error(errorClave);

  const bd = await pool.connect();
  try {
    const admin = (await bd.query(
      `SELECT id, nombre FROM usuarias WHERE perfil = 'administradora' ORDER BY id LIMIT 1`)).rows[0];
    if (!admin) throw new Error('No hay administradora. Créala antes con: node db/crear-admin.js');

    const { terminado, aMedias } = await elegirCursos(bd);
    const leccionesA = await leccionesDe(bd, terminado.id);
    const leccionesB = await leccionesDe(bd, aMedias.id);

    // Un solo hash para todas (misma contraseña); cifrar con Argon2id tarda un poco a propósito
    const hash = await cifrarPassword(PASSWORD);

    // Todo o nada: si algo falla, no se queda la demo a medias
    await bd.query('BEGIN');

    // 1. Borrar la demo anterior (CASCADE: inscripciones, dudas, trabajos, reseñas, servicios...)
    await bd.query('DELETE FROM usuarias WHERE email LIKE $1', ['%' + DOMINIO_DEMO]);

    // 2. Crear las cuentas, ya verificadas (en la demo no hace falta abrir el correo)
    const id = {};
    for (const [clave, c] of Object.entries(CUENTAS)) {
      const { rows } = await bd.query(
        `INSERT INTO usuarias (nombre, email, password, perfil, email_verificado_en, creada_en)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days') RETURNING id`,
        [c.nombre, c.email, hash, c.perfil]);
      id[clave] = rows[0].id;
    }

    // Bea: bloqueada tras 3 contraseñas mal (solo la admin la desbloquea)
    await bd.query(
      `UPDATE usuarias SET intentos_fallidos = 3, bloqueada_en = NOW() - INTERVAL '1 hour' WHERE id = $1`, [id.bea]);

    // 3. Lucía TERMINA el primer curso → certificado + puede reseñar
    await bd.query(
      `INSERT INTO inscripciones (usuaria_id, curso_id, pagado, importe, terminado, terminado_en, fecha)
       VALUES ($1, $2, TRUE, $3, TRUE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days')`,
      [id.lucia, terminado.id, terminado.precio]);
    for (const l of leccionesA) {
      await bd.query(
        `INSERT INTO progreso_lecciones (usuaria_id, leccion_id, fecha) VALUES ($1, $2, NOW() - INTERVAL '3 days')`,
        [id.lucia, l.id]);
    }
    await bd.query(
      `INSERT INTO resenas_cursos (usuaria_id, curso_id, estrellas, comentario, fecha)
       VALUES ($1, $2, 5, 'Muy bien explicado, paso a paso. Ya lo hago en casa a mis amigas 💅', NOW() - INTERVAL '1 day')`,
      [id.lucia, terminado.id]);

    // Duda de Lucía con dos respuestas: una de Sofía y la DESTACADA de la administradora (sin leer → aviso 🔔)
    const duda1 = (await bd.query(
      `INSERT INTO dudas (leccion_id, usuaria_id, texto, fecha)
       VALUES ($1, $2, '¿Cada cuánto tengo que desinfectar las herramientas si atiendo a varias clientas seguidas?', NOW() - INTERVAL '8 days')
       RETURNING id`, [leccionesA[0].id, id.lucia])).rows[0].id;
    await bd.query(
      `INSERT INTO respuestas (duda_id, usuaria_id, texto, fecha, leida)
       VALUES ($1, $2, 'Yo tengo dos juegos: mientras uso uno, el otro se está desinfectando.', NOW() - INTERVAL '7 days', TRUE)`,
      [duda1, id.sofia]);
    await bd.query(
      `INSERT INTO respuestas (duda_id, usuaria_id, texto, destacada, fecha, leida)
       VALUES ($1, $2, 'Después de CADA clienta: limpia los restos y desinfecta. Lo ideal es tener dos juegos, como dice Sofía.', TRUE, NOW() - INTERVAL '6 days', FALSE)`,
      [duda1, admin.id]);

    // 4. Marta va A MEDIAS en el segundo curso → todavía no puede reseñar
    await bd.query(
      `INSERT INTO inscripciones (usuaria_id, curso_id, pagado, importe, fecha)
       VALUES ($1, $2, TRUE, $3, NOW() - INTERVAL '5 days')`,
      [id.marta, aMedias.id, aMedias.precio]);
    const hechas = Math.floor(leccionesB.length / 2); // la mitad (si solo hay 1 lección, ninguna)
    for (const l of leccionesB.slice(0, hechas)) {
      await bd.query(`INSERT INTO progreso_lecciones (usuaria_id, leccion_id) VALUES ($1, $2)`, [id.marta, l.id]);
    }
    // Duda SIN responder: la administradora la responde y la destaca en directo
    await bd.query(
      `INSERT INTO dudas (leccion_id, usuaria_id, texto, fecha)
       VALUES ($1, $2, 'Me salen burbujas al aplicar el color. ¿Qué estoy haciendo mal?', NOW() - INTERVAL '1 hour')`,
      [leccionesB[0].id, id.marta]);

    // 5. Muro de trabajos (copias de las portadas que ya tienes)
    const foto1 = fotoDemo('demo-trabajo-lucia.jpg', ['uploads/imagenes/portada-esmaltado.jpg', 'public/img/portada-inicio.jpg']);
    const foto2 = fotoDemo('demo-trabajo-sofia.jpg', ['uploads/imagenes/portada-nailart.jpg', 'public/img/portada-inicio.jpg']);
    const foto3 = fotoDemo('demo-trabajo-marta.jpg', ['uploads/imagenes/portada-cejas.jpg', 'public/img/portada-inicio.jpg']);
    let trabajoLucia = null;
    if (foto1) {
      trabajoLucia = (await bd.query(
        `INSERT INTO trabajos (usuaria_id, curso_id, foto, descripcion, permiso_mi_estilo, fecha)
         VALUES ($1, $2, $3, 'Mi primer trabajo tras terminar el curso ✨', TRUE, NOW() - INTERVAL '1 day') RETURNING id`,
        [id.lucia, terminado.id, foto1])).rows[0].id;
    }
    if (foto2) {
      await bd.query(
        `INSERT INTO trabajos (usuaria_id, curso_id, foto, descripcion, permiso_mi_estilo, fecha)
         VALUES ($1, $2, $3, 'Diseño para una boda 💍', TRUE, NOW() - INTERVAL '3 days')`,
        [id.sofia, terminado.id, foto2]);
    }
    if (foto3) {
      // SIN permiso: sale en el muro, pero NO en Mi Estilo (consentimiento explícito)
      await bd.query(
        `INSERT INTO trabajos (usuaria_id, curso_id, foto, descripcion, permiso_mi_estilo, fecha)
         VALUES ($1, $2, $3, 'Practicando lo que llevo del curso', FALSE, NOW() - INTERVAL '2 hours')`,
        [id.marta, aMedias.id, foto3]);
    }

    // 6. Carmen (clienta) guarda el trabajo de Lucía en Mi Estilo
    if (trabajoLucia) {
      await bd.query('INSERT INTO favoritos (usuaria_id, trabajo_id) VALUES ($1, $2)', [id.carmen, trabajoLucia]);
    }

    // 7. Sofía tiene un servicio guardado en la calculadora (y lo enseña en su perfil)
    const materiales = [
      { nombre: 'Base', coste: 0.8 }, { nombre: 'Color', coste: 1.2 },
      { nombre: 'Top coat', coste: 0.8 }, { nombre: 'Lima', coste: 0.5 }
    ];
    const minutos = 60, precioHora = 15, margen = 30;
    const servicio = (await bd.query(
      `INSERT INTO servicios (usuaria_id, categoria_id, curso_id, nombre, minutos, precio_hora, margen, precio_sugerido, publico)
       VALUES ($1, $2, $3, 'Manicura completa', $4, $5, $6, $7, TRUE) RETURNING id`,
      [id.sofia, terminado.categoria_id, terminado.id, minutos, precioHora, margen,
       calcularPrecio(materiales, minutos, precioHora, margen)])).rows[0].id;
    for (const m of materiales) {
      await bd.query('INSERT INTO materiales_servicio (servicio_id, nombre, coste) VALUES ($1, $2, $3)',
        [servicio, m.nombre, m.coste]);
    }

    // Sofía: su «Mi negocio» (25/11), para que salga en el directorio de Profesionales
    // y en su perfil público (sin datos personales: solo ciudad, zona y especialidades)
    await bd.query(
      `INSERT INTO fichas_profesionales (usuaria_id, nombre_negocio, ciudad, zona, especialidades,
         anios_experiencia, a_domicilio, instagram, sobre_mi)
       VALUES ($1, 'Studio Sofía Nails', 'Madrid', 'Chamberí', $2, 4, TRUE, 'studio.sofia.nails', $3)`,
      [id.sofia, [terminado.categoria_id],
       'Manicura y esmaltado semipermanente con acabado natural. Certificada en GLAMIO. También voy a domicilio.']);

    await bd.query('COMMIT');

    // Resumen para tener a mano durante la presentación
    console.log('\n✅ Datos de la demo listos\n');
    console.log(`Contraseña de todas las cuentas demo: ${PASSWORD}\n`);
    console.table([
      { cuenta: CUENTAS.lucia.email,  perfil: 'alumna',      'qué enseñar': `Terminó "${terminado.titulo}": certificado, reseña, aviso 🔔 de respuesta destacada` },
      { cuenta: CUENTAS.marta.email,  perfil: 'alumna',      'qué enseñar': `Va a medias en "${aMedias.titulo}" (${hechas}/${leccionesB.length}): no puede reseñar; duda sin responder` },
      { cuenta: CUENTAS.sofia.email,  perfil: 'profesional', 'qué enseñar': '«Mi negocio», directorio de Profesionales y su carta de servicios (Manicura completa)' },
      { cuenta: CUENTAS.carmen.email, perfil: 'clienta',     'qué enseñar': 'Mi Estilo con un favorito (solo fotos con permiso)' },
      { cuenta: CUENTAS.bea.email,    perfil: 'alumna',      'qué enseñar': 'Bloqueada: desbloquéala desde el Panel → Cuentas bloqueadas' }
    ]);
    console.log(`La administradora (${admin.nombre}) responde la duda de Marta en "${leccionesB[0].titulo}".\n`);
  } catch (err) {
    await bd.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    bd.release();
    await pool.end();
  }
}

crearDemo().catch(err => { console.error('❌', err.message); process.exit(1); });
