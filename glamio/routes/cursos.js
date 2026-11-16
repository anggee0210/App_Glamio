// Academia: cursos, inscripción, progreso y certificado
const express = require('express');
const pool = require('../db/pool');
const { requiereLogin, requiereAdmin, requierePerfil } = require('../middleware/auth');
const { subir, rutaPublica, borrarArchivo, rechazar } = require('../middleware/subidas');
const router = express.Router();

// GET /api/cursos?categoria=1  → lista (filtro opcional por categoría)
router.get('/', async (req, res, next) => {
  try {
    const { categoria } = req.query;
    if (categoria && !/^\d+$/.test(categoria)) return res.status(400).json({ error: 'Categoría no válida' });
    // Media y número de reseñas visibles (las ocultas por un reporte no cuentan) y número de lecciones:
    // las tarjetas del inicio enseñan "★ 4,8 (12)".
    let sql = `SELECT c.*, cat.nombre AS categoria,
                 (SELECT ROUND(AVG(estrellas),1) FROM resenas_cursos r WHERE r.curso_id = c.id AND NOT r.oculta) AS media,
                 (SELECT COUNT(*) FROM resenas_cursos r WHERE r.curso_id = c.id AND NOT r.oculta)::int AS num_resenas,
                 (SELECT COUNT(*) FROM lecciones l WHERE l.curso_id = c.id)::int AS num_lecciones
               FROM cursos c JOIN categorias cat ON cat.id = c.categoria_id`;
    const params = [];
    if (categoria) { sql += ' WHERE c.categoria_id = $1'; params.push(categoria); }
    sql += ' ORDER BY c.id';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/cursos/:id  → curso con lecciones y materiales
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const curso = await pool.query(
      `SELECT c.*, cat.nombre AS categoria FROM cursos c
       JOIN categorias cat ON cat.id = c.categoria_id WHERE c.id = $1`, [id]);
    if (!curso.rows[0]) return res.status(404).json({ error: 'Curso no encontrado' });

    // Decimos SI tiene vídeo (true/false), pero no la ruta del archivo:
    // esta lista es pública y el vídeo solo lo deben ver las inscritas.
    const lecciones = await pool.query(
      `SELECT id, titulo, orden,
              (video_url IS NOT NULL) AS tiene_youtube,
              (video_local IS NOT NULL) AS tiene_video_propio
       FROM lecciones WHERE curso_id = $1 ORDER BY orden, id`, [id]); // con el mismo orden, va primero la más antigua
    const materiales = await pool.query('SELECT * FROM materiales_curso WHERE curso_id = $1', [id]);
    res.json({ ...curso.rows[0], lecciones: lecciones.rows, materiales: materiales.rows });
  } catch (err) { next(err); }
});

// Comprueba los datos de un curso. Devuelve el mensaje de error, o null si todo está bien.
function validarCurso(req) {
  const { titulo, precio, categoria_id } = req.body;
  if (!titulo || !categoria_id) return 'Faltan datos: título y categoría';
  const precioNum = Number(precio || 0);
  if (isNaN(precioNum) || precioNum < 0) return 'El precio no es válido';
  if (req.file && !req.file.mimetype.startsWith('image/')) return 'La portada tiene que ser una imagen';
  if (req.body.imagen_ajuste !== undefined && !AJUSTES.includes(req.body.imagen_ajuste)) return 'El ajuste de la foto no es válido';
  for (const campo of ['imagen_x', 'imagen_y']) {           // posición de la foto: de 0 a 100 (%)
    if (req.body[campo] === undefined) continue;
    const n = Number(req.body[campo]);
    if (req.body[campo] === '' || !Number.isFinite(n) || n < 0 || n > 100) return 'La posición de la foto no es válida';
  }
  return null;
}
// Cómo se ajusta la foto de portada a su cuadro: rellenarlo (recorta bordes) o verse completa
const AJUSTES = ['rellenar', 'completa'];

// POST /api/cursos  (solo admin)
router.post('/', requiereAdmin, subir.single('imagen'), async (req, res, next) => {
  try {
    const { titulo, descripcion, precio, categoria_id } = req.body;
    const error = validarCurso(req);
    if (error) return rechazar(req, res, 400, error);
    const { rows } = await pool.query(
      `INSERT INTO cursos (academia_id, categoria_id, titulo, descripcion, precio, imagen, imagen_ajuste, imagen_x, imagen_y)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [categoria_id, titulo, descripcion, precio || 0, rutaPublica(req.file), req.body.imagen_ajuste || 'rellenar',
       req.body.imagen_x ?? 50, req.body.imagen_y ?? 50]
    );
    res.status(201).json(rows[0]);
  } catch (err) { borrarArchivo(rutaPublica(req.file)); next(err); }
});

// POST /api/cursos/:id/materiales  (solo admin)
router.post('/:id/materiales', requiereAdmin, async (req, res, next) => {
  try {
    const { nombre, cantidad } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO materiales_curso (curso_id, nombre, cantidad) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, nombre, cantidad]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/cursos/:id  (solo admin) → editar un curso
// La imagen es opcional: si no se sube una nueva, se queda la que había.
router.put('/:id', requiereAdmin, subir.single('imagen'), async (req, res, next) => {
  try {
    const error = validarCurso(req);
    if (error) return rechazar(req, res, 400, error);

    const antes = await pool.query('SELECT imagen FROM cursos WHERE id = $1', [req.params.id]);
    if (!antes.rows[0]) return rechazar(req, res, 404, 'Curso no encontrado');

    const { titulo, descripcion, precio, categoria_id } = req.body;
    const nuevaImagen = rutaPublica(req.file);
    // COALESCE($5, imagen): si $5 es null (no hay imagen nueva), deja la columna como estaba
    const { rows } = await pool.query(
      `UPDATE cursos SET titulo = $1, descripcion = $2, precio = $3, categoria_id = $4,
              imagen = COALESCE($5, imagen), imagen_ajuste = COALESCE($7, imagen_ajuste),
              imagen_x = COALESCE($8, imagen_x), imagen_y = COALESCE($9, imagen_y)
       WHERE id = $6 RETURNING *`,
      [titulo, descripcion, precio || 0, categoria_id, nuevaImagen, req.params.id, req.body.imagen_ajuste || null,
       req.body.imagen_x ?? null, req.body.imagen_y ?? null]
    );
    if (nuevaImagen) borrarArchivo(antes.rows[0].imagen); // la portada vieja ya no se usa
    res.json(rows[0]);
  } catch (err) { borrarArchivo(rutaPublica(req.file)); next(err); }
});

// PUT /api/cursos/materiales/:id  (solo admin) → corregir un material
router.put('/materiales/:id', requiereAdmin, async (req, res, next) => {
  try {
    const { nombre, cantidad } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre del material' });
    const { rows } = await pool.query(
      'UPDATE materiales_curso SET nombre = $1, cantidad = $2 WHERE id = $3 RETURNING *',
      [nombre, cantidad, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Material no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/cursos/materiales/:id  (solo admin)
// Los materiales sí se pueden borrar: no tienen reseñas ni progreso que dependan de ellos.
router.delete('/materiales/:id', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM materiales_curso WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Material no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/cursos/:id/inscribirse  (pago simulado)
// Solo alumnas y profesionales hacen cursos (la clienta solo ve el muro y la admin los crea).
// Si el curso es de pago, la página tiene que mandar { pago_simulado: true },
// que es lo que envía el botón "Pagar (simulado)" del resumen.
router.post('/:id/inscribirse', requierePerfil('alumna', 'profesional'), async (req, res, next) => {
  try {
    const curso = (await pool.query('SELECT precio FROM cursos WHERE id = $1', [req.params.id])).rows[0];
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const esDePago = Number(curso.precio) > 0;
    if (esDePago && !(req.body && req.body.pago_simulado === true)) {
      return res.status(400).json({ error: 'Este curso es de pago: confirma el pago simulado' });
    }

    const { rows } = await pool.query(
      // importe = lo que costaba al comprarlo (las estadísticas de ventas usan esta cifra)
      `INSERT INTO inscripciones (usuaria_id, curso_id, pagado, importe) VALUES ($1, $2, TRUE, $3)
       ON CONFLICT (usuaria_id, curso_id) DO NOTHING RETURNING *`,
      [req.session.usuaria.id, req.params.id, Number(curso.precio)]
    );
    if (!rows[0]) return res.json({ mensaje: 'Ya estabas inscrita' });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/cursos/:id/progreso  → % y si está terminado
router.get('/:id/progreso', requiereLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM lecciones WHERE curso_id = $1)::int AS total,
         (SELECT COUNT(*) FROM progreso_lecciones p JOIN lecciones l ON l.id = p.leccion_id
           WHERE l.curso_id = $1 AND p.usuaria_id = $2)::int AS hechas,
         (SELECT terminado FROM inscripciones WHERE curso_id = $1 AND usuaria_id = $2) AS terminado,
         -- lista de ids de las lecciones completadas, para marcarlas con ✅ en la ficha
         (SELECT COALESCE(array_agg(p.leccion_id), '{}') FROM progreso_lecciones p
           JOIN lecciones l ON l.id = p.leccion_id
           WHERE l.curso_id = $1 AND p.usuaria_id = $2) AS completadas`,
      [req.params.id, req.session.usuaria.id]
    );
    const p = rows[0];
    p.porcentaje = p.total ? Math.round((p.hechas / p.total) * 100) : 0;
    res.json(p);
  } catch (err) { next(err); }
});

// GET /api/cursos/:id/certificado  → datos para el certificado
router.get('/:id/certificado', requiereLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.nombre, u.perfil, c.titulo, cat.nombre AS categoria,
              (SELECT COUNT(*) FROM lecciones WHERE curso_id = c.id)::int AS lecciones,
              i.id AS numero,               -- nº de certificado: el de la inscripción (único)
              i.terminado_en AS fecha       -- fecha real de fin, no la de hoy
       FROM inscripciones i
       JOIN usuarias u ON u.id = i.usuaria_id
       JOIN cursos c ON c.id = i.curso_id
       JOIN categorias cat ON cat.id = c.categoria_id
       WHERE i.curso_id = $1 AND i.usuaria_id = $2 AND i.terminado = TRUE`,
      [req.params.id, req.session.usuaria.id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Aún no has terminado este curso' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/cursos/:id  (solo admin) → borra el curso entero
// En cascada se borran sus lecciones, materiales, inscripciones (y con ellas el progreso y el certificado),
// dudas, reseñas y guías. Los trabajos del muro y los servicios de la calculadora se quedan "sin curso".
// Protección: si tiene alumnas inscritas, la primera vez responde 409 con cuántas son, y solo se borra
// si se repite con ?confirmar=si (la pantalla pide una segunda confirmación).
router.delete('/:id', requiereAdmin, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Curso no encontrado' });
    const curso = (await pool.query('SELECT titulo, imagen FROM cursos WHERE id = $1', [req.params.id])).rows[0];
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const inscritas = (await pool.query('SELECT COUNT(*)::int AS n FROM inscripciones WHERE curso_id = $1', [req.params.id])).rows[0].n;
    if (inscritas > 0 && req.query.confirmar !== 'si') {
      return res.status(409).json({ inscritas,
        error: `«${curso.titulo}» tiene ${inscritas} ${inscritas === 1 ? 'persona inscrita' : 'personas inscritas'}: perderían su progreso, su certificado y sus reseñas de este curso.` });
    }

    // Archivos que hay que borrar del disco después (la base solo guarda sus rutas)
    const videos = (await pool.query('SELECT video_local FROM lecciones WHERE curso_id = $1 AND video_local IS NOT NULL', [req.params.id])).rows;
    const guias = (await pool.query('SELECT archivo FROM guias WHERE curso_id = $1', [req.params.id])).rows;

    await pool.query('DELETE FROM cursos WHERE id = $1', [req.params.id]);

    borrarArchivo(curso.imagen);
    videos.forEach(v => borrarArchivo(v.video_local));
    const carpetaGuias = require('path').join(__dirname, '..', 'privado', 'guias');
    guias.forEach(g => require('fs').unlink(require('path').join(carpetaGuias, require('path').basename(g.archivo)), () => {}));
    res.json({ ok: true, borrado: curso.titulo });
  } catch (err) { next(err); }
});

module.exports = router;
