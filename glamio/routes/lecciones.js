// Lecciones: ver, crear (admin) y marcar como completada
const express = require('express');
const pool = require('../db/pool');
const { requiereLogin, requiereAdmin } = require('../middleware/auth');
const { subir, rutaPublica, borrarArchivo, rechazar } = require('../middleware/subidas');
const router = express.Router();

// Marca como terminadas las inscripciones de un curso que ya tienen todas sus lecciones hechas.
// - usuariaId opcional: si se pasa, solo revisa a esa alumna; si no, a todas las del curso.
// - "AND NOT terminado": la fecha de fin se guarda UNA vez y no cambia nunca
//   (si luego se añaden lecciones, el curso sigue terminado: decisión del proyecto).
async function actualizarTerminados(cursoId, usuariaId = null) {
  await pool.query(
    `UPDATE inscripciones i SET terminado = TRUE, terminado_en = NOW()
     WHERE i.curso_id = $1 AND NOT i.terminado
       AND ($2::int IS NULL OR i.usuaria_id = $2)
       AND (SELECT COUNT(*) FROM lecciones WHERE curso_id = $1) > 0
       AND (SELECT COUNT(*) FROM lecciones WHERE curso_id = $1) =
           (SELECT COUNT(*) FROM progreso_lecciones p JOIN lecciones l ON l.id = p.leccion_id
            WHERE l.curso_id = $1 AND p.usuaria_id = i.usuaria_id)`,
    [cursoId, usuariaId]);
}

// GET /api/lecciones/:id  (hay que estar inscrita)
router.get('/:id', requiereLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM lecciones WHERE id = $1', [req.params.id]);
    const leccion = rows[0];
    if (!leccion) return res.status(404).json({ error: 'Lección no encontrada' });

    const insc = await pool.query(
      'SELECT 1 FROM inscripciones WHERE usuaria_id = $1 AND curso_id = $2',
      [req.session.usuaria.id, leccion.curso_id]
    );
    if (!insc.rows[0] && req.session.usuaria.perfil !== 'administradora') {
      return res.status(403).json({ error: 'Inscríbete en el curso para ver la lección' });
    }
    // ¿Esta usuaria ya la completó? (para que el botón diga "✅ Completada")
    const hecha = await pool.query('SELECT 1 FROM progreso_lecciones WHERE usuaria_id = $1 AND leccion_id = $2',
      [req.session.usuaria.id, leccion.id]);
    leccion.completada = !!hecha.rows[0];
    leccion.inscrita = !!insc.rows[0]; // la admin puede verla sin estar inscrita, pero no completarla
    res.json(leccion);
  } catch (err) { next(err); }
});

// Comprueba los datos de una lección. Devuelve el mensaje de error, o null si todo está bien.
// esNueva = true al crear (ahí el vídeo es obligatorio); al editar se puede dejar el que había.
function validarLeccion(req, esNueva) {
  const { titulo, orden, video_url } = req.body;
  if (!titulo) return 'Falta el título de la lección';
  if (orden !== undefined && orden !== '' && !(parseInt(orden) >= 1)) return 'El orden tiene que ser un número desde 1';
  if (req.file && !req.file.mimetype.startsWith('video/')) return 'El archivo tiene que ser un vídeo';
  // Regla: YouTube O vídeo propio, nunca los dos (si no, uno de ellos no se vería nunca)
  if (req.file && video_url) return 'Elige YouTube o vídeo propio, no los dos';
  if (esNueva && !req.file && !video_url) return 'Añade un enlace de YouTube o un vídeo corto';
  return null;
}

// POST /api/lecciones  (solo admin; video por enlace o archivo corto)
router.post('/', requiereAdmin, subir.single('video'), async (req, res, next) => {
  try {
    const error = validarLeccion(req, true);
    if (error) return rechazar(req, res, 400, error);
    const { curso_id, titulo, orden, video_url, contenido } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO lecciones (curso_id, titulo, orden, video_url, video_local, contenido)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [curso_id, titulo, orden || 1, video_url || null, rutaPublica(req.file), contenido]
    );
    res.status(201).json(rows[0]);
  } catch (err) { borrarArchivo(rutaPublica(req.file)); next(err); }
});

// PUT /api/lecciones/:id  (solo admin) → editar una lección
// Vídeo: si llega uno nuevo se usa ese y se quita el enlace de YouTube;
// si llega un enlace se usa ese y se quita el vídeo propio; si no llega nada, se queda el que había.
router.put('/:id', requiereAdmin, subir.single('video'), async (req, res, next) => {
  try {
    const error = validarLeccion(req, false);
    if (error) return rechazar(req, res, 400, error);

    const antes = (await pool.query('SELECT * FROM lecciones WHERE id = $1', [req.params.id])).rows[0];
    if (!antes) return rechazar(req, res, 404, 'Lección no encontrada');

    const { titulo, orden, video_url, contenido } = req.body;
    let enlace = antes.video_url;
    let propio = antes.video_local;
    if (req.file) { propio = rutaPublica(req.file); enlace = null; }
    else if (video_url) { enlace = video_url; propio = null; }

    const { rows } = await pool.query(
      `UPDATE lecciones SET titulo = $1, orden = $2, contenido = $3, video_url = $4, video_local = $5
       WHERE id = $6 RETURNING *`,
      [titulo, orden || antes.orden, contenido, enlace, propio, req.params.id]
    );
    // Si el vídeo propio de antes ya no se usa, se borra del disco
    if (antes.video_local && antes.video_local !== propio) borrarArchivo(antes.video_local);
    res.json(rows[0]);
  } catch (err) { borrarArchivo(rutaPublica(req.file)); next(err); }
});

// DELETE /api/lecciones/:id/video  (solo admin) → quita el vídeo pero deja la lección
// (con su texto, sus dudas y el progreso de las alumnas), para poder poner otro.
router.delete('/:id/video', requiereAdmin, async (req, res, next) => {
  try {
    const antes = (await pool.query('SELECT video_local FROM lecciones WHERE id = $1', [req.params.id])).rows[0];
    if (!antes) return res.status(404).json({ error: 'Lección no encontrada' });
    await pool.query('UPDATE lecciones SET video_url = NULL, video_local = NULL WHERE id = $1', [req.params.id]);
    borrarArchivo(antes.video_local); // si era de YouTube no hay archivo y no hace nada
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/lecciones/:id  (solo admin) → borra la lección entera.
// Ojo: por ON DELETE CASCADE también se borran sus dudas, respuestas y el progreso.
router.delete('/:id', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM lecciones WHERE id = $1 RETURNING video_local, curso_id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lección no encontrada' });
    borrarArchivo(rows[0].video_local);
    // Si alguna alumna solo tenía pendiente ESTA lección, ahora ya ha terminado el curso
    await actualizarTerminados(rows[0].curso_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/lecciones/:id/completar
// Marca la lección y, si era la última, termina la inscripción
router.post('/:id/completar', requiereLogin, async (req, res, next) => {
  try {
    const usuariaId = req.session.usuaria.id;
    const leccionId = req.params.id;

    // La lección tiene que existir y la usuaria tiene que estar inscrita en su curso
    const leccion = (await pool.query('SELECT curso_id FROM lecciones WHERE id = $1', [leccionId])).rows[0];
    if (!leccion) return res.status(404).json({ error: 'Lección no encontrada' });
    const insc = await pool.query('SELECT 1 FROM inscripciones WHERE usuaria_id = $1 AND curso_id = $2',
      [usuariaId, leccion.curso_id]);
    if (!insc.rows[0]) return res.status(403).json({ error: 'Inscríbete en el curso para marcar sus lecciones' });

    await pool.query(
      `INSERT INTO progreso_lecciones (usuaria_id, leccion_id) VALUES ($1, $2)
       ON CONFLICT (usuaria_id, leccion_id) DO NOTHING`, [usuariaId, leccionId]);

    const { rows } = await pool.query(
      `SELECT l.curso_id,
         (SELECT COUNT(*) FROM lecciones WHERE curso_id = l.curso_id)::int AS total,
         (SELECT COUNT(*) FROM progreso_lecciones p JOIN lecciones x ON x.id = p.leccion_id
           WHERE x.curso_id = l.curso_id AND p.usuaria_id = $2)::int AS hechas
       FROM lecciones l WHERE l.id = $1`, [leccionId, usuariaId]);

    const { curso_id, total, hechas } = rows[0];
    await actualizarTerminados(curso_id, usuariaId); // si era la última, guarda terminado y la fecha
    const insc2 = await pool.query('SELECT terminado FROM inscripciones WHERE usuaria_id = $1 AND curso_id = $2',
      [usuariaId, curso_id]);
    res.json({ hechas, total, terminado: insc2.rows[0].terminado });
  } catch (err) { next(err); }
});

module.exports = router;
