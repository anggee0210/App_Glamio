// Ficha personal de la alumna (18/11)
// Decisiones: solo la alumna tiene ficha. Ella la rellena UNA VEZ, al registrarse (obligatoria,
// 24/11: routes/auth.js usa validarFicha y escribirFicha de aquí). Después SOLO LA ADMINISTRADORA
// la modifica y borra (Panel → Alumnas); la alumna la VE en "Mi cuenta → Mis datos", sin poder cambiarla.
// Nadie más la ve (nunca sale en el perfil público).
// El documento depende del país de nacimiento (tabla paises); quien nació fuera de España
// también puede dar su NIE. Edad mínima: 14 años (en España, desde los 14 una persona
// puede dar sus datos sin permiso de sus padres).
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil, requiereAdmin } = require('../middleware/auth');
const { esId } = require('../middleware/permisos');
const { normalizarEmail, emailValido } = require('../middleware/seguridad');
const { borrarArchivo } = require('../middleware/subidas');
const router = express.Router();

const EDAD_MINIMA = 14;
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const PATRON_NIE = /^[XYZ][0-9]{7}[A-Z]$/;

// ---------- Ayudantes ----------

// Texto limpio: sin espacios al principio/final y con los espacios dobles reducidos
function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

// El número del documento se guarda SIEMPRE igual: mayúsculas, sin espacios, puntos ni guiones.
// Así "12.345.678-z" y "12345678Z" son el mismo documento (y el UNIQUE de la BD funciona).
function limpiarDocumento(valor) {
  return typeof valor === 'string' ? valor.toUpperCase().replace(/[\s.\-]/g, '') : '';
}

// Teléfono: se quitan espacios, guiones, puntos y paréntesis; queda "+34600111222" o "600111222"
function limpiarTelefono(valor) {
  return typeof valor === 'string' ? valor.replace(/[\s.\-()]/g, '') : '';
}

// La letra del DNI se calcula: número % 23 → posición en LETRAS_DNI.
// En el NIE, la primera letra se cambia por una cifra (X=0, Y=1, Z=2) y se hace igual.
function letraCorrecta(numero) {
  const cifras = numero.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2');
  return LETRAS_DNI[Number(cifras) % 23] === numero.slice(-1);
}

// Edad en años cumplidos a día de hoy (fecha 'AAAA-MM-DD')
function edad(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const hoy = new Date();
  let anios = hoy.getFullYear() - a;
  // si este año todavía no ha llegado su cumpleaños, tiene uno menos
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios--;
  return anios;
}

// ¿Es una fecha real con formato AAAA-MM-DD? (rechaza 2001-02-30)
function esFecha(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const f = new Date(texto + 'T00:00:00Z');
  return !isNaN(f) && f.toISOString().slice(0, 10) === texto;
}

// Comprueba todos los datos. Devuelve { error } o { ficha } ya limpia.
async function validarFicha(cuerpo) {
  const b = cuerpo || {};
  const ficha = {
    nombre_completo: limpiarTexto(b.nombre_completo),
    pais_nacimiento: limpiarTexto(b.pais_nacimiento).toUpperCase(),
    ciudad_nacimiento: limpiarTexto(b.ciudad_nacimiento),
    numero_documento: limpiarDocumento(b.numero_documento),
    usa_nie: b.usa_nie === true,
    fecha_nacimiento: limpiarTexto(b.fecha_nacimiento),
    direccion: limpiarTexto(b.direccion),
    telefono: limpiarTelefono(b.telefono)
  };

  // Nombre completo: letras (también con tilde), espacios, guion y apóstrofo; al menos nombre y apellido
  if (ficha.nombre_completo.length < 5 || ficha.nombre_completo.length > 150)
    return { error: 'Escribe tu nombre completo (entre 5 y 150 caracteres)' };
  if (!/^[\p{L}][\p{L} '’.\-]*$/u.test(ficha.nombre_completo))
    return { error: 'El nombre solo puede llevar letras, espacios y guiones' };
  if (ficha.nombre_completo.split(' ').length < 2)
    return { error: 'Escribe tu nombre y al menos un apellido' };

  // País: tiene que estar en la tabla paises
  const pais = (await pool.query('SELECT codigo, nombre, documento, patron, ejemplo FROM paises WHERE codigo = $1',
    [ficha.pais_nacimiento])).rows[0];
  if (!pais) return { error: 'Elige tu país de nacimiento de la lista' };

  if (ficha.ciudad_nacimiento.length < 2 || ficha.ciudad_nacimiento.length > 100)
    return { error: 'Escribe la ciudad donde naciste' };

  // Documento: NIE o el del país
  if (!ficha.numero_documento) return { error: 'Escribe el número de tu documento' };
  if (ficha.numero_documento.length > 20) return { error: 'El número del documento es demasiado largo' };
  if (ficha.usa_nie) {
    if (pais.codigo === 'ES') return { error: 'Si naciste en España, tu documento es el DNI' };
    if (!PATRON_NIE.test(ficha.numero_documento))
      return { error: 'El NIE tiene una letra (X, Y o Z), 7 cifras y otra letra. Ejemplo: X1234567L' };
    if (!letraCorrecta(ficha.numero_documento)) return { error: 'La letra del NIE no es correcta' };
  } else {
    if (!new RegExp(pais.patron).test(ficha.numero_documento))
      return { error: `El ${pais.documento} de ${pais.nombre} no tiene ese formato. Ejemplo: ${pais.ejemplo}` };
    if (pais.codigo === 'ES' && !letraCorrecta(ficha.numero_documento))
      return { error: 'La letra del DNI no es correcta' };
  }

  // Fecha de nacimiento: real, no futura y con la edad mínima
  if (!esFecha(ficha.fecha_nacimiento)) return { error: 'Escribe una fecha de nacimiento válida' };
  if (ficha.fecha_nacimiento < '1900-01-01') return { error: 'Revisa el año de nacimiento' };
  if (edad(ficha.fecha_nacimiento) < EDAD_MINIMA)
    return { error: `Tienes que tener al menos ${EDAD_MINIMA} años para dar tus datos` };

  if (ficha.direccion.length < 5 || ficha.direccion.length > 200)
    return { error: 'Escribe tu dirección (calle, número, ciudad)' };

  if (!/^\+?[0-9]{9,15}$/.test(ficha.telefono))
    return { error: 'El teléfono tiene que tener entre 9 y 15 cifras (puede empezar por +)' };

  return { ficha };
}

// Lo que se devuelve de una ficha: todos sus datos + el nombre del documento ya resuelto
const CAMPOS_FICHA = `
  f.usuaria_id, f.nombre_completo, f.pais_nacimiento, p.nombre AS pais, f.ciudad_nacimiento,
  CASE WHEN f.usa_nie THEN 'NIE' ELSE p.documento END AS documento,
  f.numero_documento, f.usa_nie, to_char(f.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
  f.direccion, f.telefono, f.actualizada_en`;

// ---------- Rutas ----------

// GET /api/ficha/paises → la lista para el desplegable (pública: no tiene datos personales)
router.get('/paises', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT codigo, nombre, documento, ejemplo FROM paises ORDER BY orden, nombre');
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/ficha/alumnas → la administradora ve TODAS las alumnas, con o sin ficha
// (LEFT JOIN: así sabe quién no la ha rellenado todavía)
router.get('/alumnas', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.creada_en, (u.bloqueada_en IS NOT NULL) AS bloqueada,
         (f.usuaria_id IS NOT NULL) AS tiene_ficha, ${CAMPOS_FICHA},
         (SELECT COUNT(*) FROM inscripciones i WHERE i.usuaria_id = u.id)::int AS cursos,
         (SELECT COUNT(*) FROM inscripciones i WHERE i.usuaria_id = u.id AND i.terminado)::int AS terminados
       FROM usuarias u
       LEFT JOIN fichas_alumnas f ON f.usuaria_id = u.id
       LEFT JOIN paises p ON p.codigo = f.pais_nacimiento
       WHERE u.perfil = 'alumna'
       ORDER BY tiene_ficha DESC, u.nombre`);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/ficha/alumnas/:id → TODA la información de una alumna (administradora, opción "Alumnas" del Panel):
//   cuenta (alta, email verificado, bloqueo), ficha personal (o null), cursos con su progreso
//   y lo que ha hecho en la Comunidad. Nunca la contraseña.
router.get('/alumnas/:id', requiereAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    const noExiste = () => res.status(404).json({ error: 'Esta alumna no existe' });
    if (!esId(id)) return noExiste();

    const cuenta = (await pool.query(
      `SELECT id, nombre, email, creada_en, email_verificado_en, bloqueada_en
       FROM usuarias WHERE id = $1 AND perfil = 'alumna'`, [id])).rows[0];
    if (!cuenta) return noExiste();

    const ficha = (await pool.query(
      `SELECT ${CAMPOS_FICHA}
       FROM fichas_alumnas f JOIN paises p ON p.codigo = f.pais_nacimiento
       WHERE f.usuaria_id = $1`, [id])).rows[0] || null;

    // Cursos: lecciones hechas / total (subconsultas, así cada número se cuenta por separado)
    const cursos = (await pool.query(
      `SELECT c.id, c.titulo, i.fecha AS inscrita_en, i.importe, i.terminado, i.terminado_en,
         (SELECT COUNT(*) FROM lecciones l WHERE l.curso_id = c.id)::int AS total_lecciones,
         (SELECT COUNT(*) FROM progreso_lecciones pl JOIN lecciones l ON l.id = pl.leccion_id
            WHERE l.curso_id = c.id AND pl.usuaria_id = i.usuaria_id AND pl.completada)::int AS lecciones_hechas
       FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
       WHERE i.usuaria_id = $1
       ORDER BY i.fecha DESC`, [id])).rows;

    // Comunidad y compras: solo cuántos (el detalle ya está en sus páginas)
    const actividad = (await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM dudas WHERE usuaria_id = $1)::int AS dudas,
         (SELECT COUNT(*) FROM trabajos WHERE usuaria_id = $1)::int AS trabajos,
         (SELECT COUNT(*) FROM resenas_cursos WHERE usuaria_id = $1)::int AS resenas,
         (SELECT COUNT(*) FROM compras_guias WHERE usuaria_id = $1)::int AS guias`, [id])).rows[0];

    // Historial de dudas (24/11): SOLO las que escribió ESTA alumna (WHERE d.usuaria_id),
    // con su lección y curso, cuántas respuestas tiene y si alguna es la destacada.
    // Las más nuevas primero. Las ocultas por un reporte también salen (marcadas), para que la
    // administradora vea el historial completo.
    const dudas = (await pool.query(
      `SELECT d.id, d.texto, d.foto, d.oculta, d.fecha,
         l.id AS leccion_id, l.titulo AS leccion, c.id AS curso_id, c.titulo AS curso,
         (SELECT COUNT(*) FROM respuestas r WHERE r.duda_id = d.id)::int AS respuestas,
         EXISTS (SELECT 1 FROM respuestas r WHERE r.duda_id = d.id AND r.destacada) AS con_destacada
       FROM dudas d
       JOIN lecciones l ON l.id = d.leccion_id
       JOIN cursos c ON c.id = l.curso_id
       WHERE d.usuaria_id = $1
       ORDER BY d.fecha DESC, d.id DESC`, [id])).rows;

    res.json({ cuenta, ficha, cursos, actividad, dudas });
  } catch (err) { next(err); }
});

// GET /api/ficha → mi ficha (alumna, solo para leer). null si la administradora todavía no la ha rellenado.
router.get('/', requierePerfil('alumna'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_FICHA}
       FROM fichas_alumnas f JOIN paises p ON p.codigo = f.pais_nacimiento
       WHERE f.usuaria_id = $1`, [req.session.usuaria.id]);
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// PUT /api/ficha → la alumna NO puede crear ni cambiar su ficha (decisión del 18/11: solo la administradora).
// Se responde con un mensaje claro en vez de "Ruta no encontrada", por si alguien lo intenta desde fuera de la página.
router.put('/', (req, res) =>
  res.status(403).json({ error: 'Tus datos solo los puede modificar la administradora de la academia' }));

// Escribe en la tabla una ficha YA VALIDADA. "bd" puede ser el pool o un cliente dentro de una
// transacción (el registro crea la cuenta y la ficha juntas: o se guardan las dos o ninguna).
// ON CONFLICT (usuaria_id) DO UPDATE: si ya existe, se actualiza. Así hay una sola consulta para crear y cambiar.
function escribirFicha(bd, usuariaId, ficha) {
  return bd.query(
    `INSERT INTO fichas_alumnas (usuaria_id, nombre_completo, pais_nacimiento, ciudad_nacimiento,
       numero_documento, usa_nie, fecha_nacimiento, direccion, telefono)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (usuaria_id) DO UPDATE SET
       nombre_completo = EXCLUDED.nombre_completo, pais_nacimiento = EXCLUDED.pais_nacimiento,
       ciudad_nacimiento = EXCLUDED.ciudad_nacimiento, numero_documento = EXCLUDED.numero_documento,
       usa_nie = EXCLUDED.usa_nie, fecha_nacimiento = EXCLUDED.fecha_nacimiento,
       direccion = EXCLUDED.direccion, telefono = EXCLUDED.telefono`,
    [usuariaId, ficha.nombre_completo, ficha.pais_nacimiento, ficha.ciudad_nacimiento,
      ficha.numero_documento, ficha.usa_nie, ficha.fecha_nacimiento, ficha.direccion, ficha.telefono]);
}

// Guarda la ficha de una alumna desde el Panel (PUT /alumnas/:id/ficha, solo la administradora).
async function guardarFicha(usuariaId, cuerpo, res, next) {
  try {
    const { error, ficha } = await validarFicha(cuerpo);
    if (error) return res.status(400).json({ error });

    await escribirFicha(pool, usuariaId, ficha);

    const { rows } = await pool.query(
      `SELECT ${CAMPOS_FICHA}
       FROM fichas_alumnas f JOIN paises p ON p.codigo = f.pais_nacimiento
       WHERE f.usuaria_id = $1`, [usuariaId]);
    res.json(rows[0]);
  } catch (err) {
    // 23505 = valor repetido (UNIQUE): ese documento ya está en otra ficha
    if (err.code === '23505') return res.status(409).json({ error: 'Ese documento ya está registrado en otra cuenta' });
    // P0001 = RAISE EXCEPTION del trigger (segunda barrera)
    if (err.code === 'P0001') return res.status(400).json({ error: err.message });
    next(err);
  }
}

// ---------- La administradora modifica o borra (opción "Alumnas" del Panel) ----------

// ¿Existe esa alumna? Devuelve su fila o null (mismo 404 si el id es raro o es de otro perfil)
async function buscarAlumna(id) {
  if (!esId(id)) return null;
  const { rows } = await pool.query(
    "SELECT id, nombre, email FROM usuarias WHERE id = $1 AND perfil = 'alumna'", [id]);
  return rows[0] || null;
}

// PUT /api/ficha/alumnas/:id/ficha → la administradora corrige (o rellena) la ficha de una alumna
router.put('/alumnas/:id/ficha', requiereAdmin, async (req, res, next) => {
  try {
    const alumna = await buscarAlumna(req.params.id);
    if (!alumna) return res.status(404).json({ error: 'Esta alumna no existe' });
    guardarFicha(alumna.id, req.body, res, next);
  } catch (err) { next(err); }
});

// DELETE /api/ficha/alumnas/:id/ficha → borra SOLO los datos personales; la cuenta y sus cursos siguen
router.delete('/alumnas/:id/ficha', requiereAdmin, async (req, res, next) => {
  try {
    const alumna = await buscarAlumna(req.params.id);
    if (!alumna) return res.status(404).json({ error: 'Esta alumna no existe' });
    const { rowCount } = await pool.query('DELETE FROM fichas_alumnas WHERE usuaria_id = $1', [alumna.id]);
    if (!rowCount) return res.status(404).json({ error: 'Esta alumna no tiene ficha' });
    res.json({ mensaje: `Ficha de ${alumna.nombre} borrada` });
  } catch (err) { next(err); }
});

// PUT /api/ficha/alumnas/:id/cuenta → corregir el nombre o el email con el que entra
// (por ejemplo, si se equivocó al registrarse). La contraseña NO se toca: eso lo hace ella.
router.put('/alumnas/:id/cuenta', requiereAdmin, async (req, res, next) => {
  try {
    const alumna = await buscarAlumna(req.params.id);
    if (!alumna) return res.status(404).json({ error: 'Esta alumna no existe' });

    const nombre = limpiarTexto(req.body && req.body.nombre);
    const email = normalizarEmail(req.body && req.body.email);
    if (nombre.length < 2 || nombre.length > 100) return res.status(400).json({ error: 'El nombre tiene que tener entre 2 y 100 caracteres' });
    if (!emailValido(email)) return res.status(400).json({ error: 'Escribe un email válido' });

    const { rows } = await pool.query(
      'UPDATE usuarias SET nombre = $1, email = $2 WHERE id = $3 RETURNING id, nombre, email',
      [nombre, email, alumna.id]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese email ya lo usa otra cuenta' });
    next(err);
  }
});

// DELETE /api/ficha/alumnas/:id?confirmar=si → BORRAR LA CUENTA ENTERA (no se puede deshacer)
// Sin ?confirmar=si responde 409 con lo que se perdería (como al borrar un curso), para que la página lo enseñe.
// La base de datos borra en cascada todo lo suyo (ficha, inscripciones, progreso, dudas, respuestas,
// trabajos, reseñas, servicios, compras, favoritos, sesiones...). Aquí se borra además lo que la cascada
// no alcanza: los reportes que OTRAS hicieron sobre sus publicaciones y sus fotos del disco.
router.delete('/alumnas/:id', requiereAdmin, async (req, res, next) => {
  let alumna;
  try { alumna = await buscarAlumna(req.params.id); } catch (err) { return next(err); }
  if (!alumna) return res.status(404).json({ error: 'Esta alumna no existe' });

  if (req.query.confirmar !== 'si') {
    try {
      const { rows } = await pool.query(
        `SELECT (SELECT COUNT(*) FROM inscripciones WHERE usuaria_id = $1)::int AS cursos,
                (SELECT COUNT(*) FROM inscripciones WHERE usuaria_id = $1 AND terminado)::int AS certificados,
                (SELECT COUNT(*) FROM trabajos WHERE usuaria_id = $1)::int AS trabajos,
                (SELECT COUNT(*) FROM dudas WHERE usuaria_id = $1)::int AS dudas,
                (SELECT COUNT(*) FROM resenas_cursos WHERE usuaria_id = $1)::int AS resenas`, [alumna.id]);
      return res.status(409).json({ error: 'Hay que confirmar el borrado', perderia: rows[0] });
    } catch (err) { return next(err); }
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Las fotos, ANTES de borrar (después ya no sabríamos cuáles eran)
    const fotos = (await cliente.query(
      `SELECT foto FROM usuarias WHERE id = $1
       UNION ALL SELECT foto FROM trabajos WHERE usuaria_id = $1
       UNION ALL SELECT foto FROM dudas WHERE usuaria_id = $1
       UNION ALL SELECT foto FROM resenas_cursos WHERE usuaria_id = $1`, [alumna.id])).rows.map(f => f.foto);
    // Reportes sobre sus publicaciones (y sobre las respuestas que otras dieron a sus dudas, que también se van)
    await cliente.query(
      `DELETE FROM reportes WHERE
         (tipo = 'trabajo'   AND elemento_id IN (SELECT id FROM trabajos WHERE usuaria_id = $1)) OR
         (tipo = 'duda'      AND elemento_id IN (SELECT id FROM dudas WHERE usuaria_id = $1)) OR
         (tipo = 'resena'    AND elemento_id IN (SELECT id FROM resenas_cursos WHERE usuaria_id = $1)) OR
         (tipo = 'respuesta' AND elemento_id IN (SELECT r.id FROM respuestas r LEFT JOIN dudas d ON d.id = r.duda_id
                                                 WHERE r.usuaria_id = $1 OR d.usuaria_id = $1))`, [alumna.id]);
    await cliente.query('DELETE FROM usuarias WHERE id = $1', [alumna.id]);
    await cliente.query('COMMIT');
    fotos.forEach(borrarArchivo); // del disco, solo cuando la base ya lo ha confirmado
    res.json({ mensaje: `Cuenta de ${alumna.nombre} borrada con todos sus datos` });
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

module.exports = router;
// El registro (routes/auth.js) usa las MISMAS comprobaciones y la misma consulta
module.exports.validarFicha = validarFicha;
module.exports.escribirFicha = escribirFicha;
