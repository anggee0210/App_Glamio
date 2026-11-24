// Comunidad: dudas con foto dentro de cada lección y respuestas
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin, requierePerfil } = require('../middleware/auth');
const { subir, rutaPublica, rechazar, borrarArchivo } = require('../middleware/subidas');
// esId y puedeEntrarEnLeccion (RN-14) también los usan los reportes: viven en permisos.js
const { esId, puedeEntrarEnLeccion } = require('../middleware/permisos');
const router = express.Router();

// Primer filtro: el perfil. La clienta no entra en las lecciones (fase 1).
// El segundo filtro (estar inscrita en ESE curso) lo hace puedeEntrarEnLeccion().
const puedeParticipar = requierePerfil('alumna', 'profesional', 'administradora');

const MAX_TEXTO = 1000;

// Texto limpio y su error (o null si está bien)
function revisarTexto(texto, que) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return { error: `Escribe tu ${que}` };
  if (limpio.length > MAX_TEXTO) return { error: `Tu ${que} es demasiado larga (máximo ${MAX_TEXTO} caracteres)` };
  return { limpio };
}

// GET /api/dudas?leccion=1  → dudas con sus respuestas (destacada primero)
// Las dudas llevan nombres y fotos de alumnas: solo las ve quien puede ver la lección (RGPD).
router.get('/', puedeParticipar, async (req, res, next) => {
  try {
    const leccionId = req.query.leccion;
    if (!esId(leccionId)) return res.status(400).json({ error: 'Falta la lección' });
    const sinPermiso = await puedeEntrarEnLeccion(req.session.usuaria, leccionId);
    if (sinPermiso) return res.status(sinPermiso.estado).json({ error: sinPermiso.error });

    const dudas = await pool.query(
      `SELECT d.*, u.nombre, u.perfil FROM dudas d JOIN usuarias u ON u.id = d.usuaria_id
       WHERE d.leccion_id = $1 AND d.oculta = FALSE ORDER BY d.fecha DESC`, [leccionId]);

    for (const duda of dudas.rows) {
      const resp = await pool.query(
        `SELECT r.*, u.nombre, u.perfil FROM respuestas r JOIN usuarias u ON u.id = r.usuaria_id
         WHERE r.duda_id = $1 AND r.oculta = FALSE ORDER BY r.destacada DESC, r.fecha`, [duda.id]);
      duda.respuestas = resp.rows;
    }
    res.json(dudas.rows);
  } catch (err) { next(err); }
});

// GET /api/dudas/sin-responder  (solo admin) → la campana 🔔 del menú
// "Sin responder" = ninguna administradora ha contestado todavía. No hace falta
// una tabla de notificaciones: en cuanto la directora responde, la duda sale sola
// de esta lista. Las ocultas (reportadas) no cuentan: esas se revisan en el Panel.
router.get('/sin-responder', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.texto, d.foto, d.fecha, d.leccion_id,
              u.nombre, u.perfil, l.titulo AS leccion, c.titulo AS curso,
              (SELECT count(*) FROM respuestas r WHERE r.duda_id = d.id AND r.oculta = FALSE)::int AS respuestas
       FROM dudas d
       JOIN usuarias u ON u.id = d.usuaria_id
       JOIN lecciones l ON l.id = d.leccion_id
       JOIN cursos c ON c.id = l.curso_id
       WHERE d.oculta = FALSE
         AND u.perfil <> 'administradora'          -- sus propias dudas no le avisan
         AND NOT EXISTS (SELECT 1 FROM respuestas r JOIN usuarias ua ON ua.id = r.usuaria_id
                         WHERE r.duda_id = d.id AND ua.perfil = 'administradora')
       ORDER BY d.fecha DESC`);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/dudas/respondidas  (solo admin) → apartado verde de Notificaciones
// Las dudas que la administradora YA respondió en los últimos 7 días, para que no
// desaparezcan de golpe: se ven en verde una semana y luego salen solas.
// No suman en la campana 🔔 (ya están hechas). "respondida_en" = su primera respuesta.
router.get('/respondidas', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.texto, d.foto, d.leccion_id, u.nombre, u.perfil,
              l.titulo AS leccion, c.titulo AS curso, x.respondida_en
       FROM dudas d
       JOIN usuarias u ON u.id = d.usuaria_id
       JOIN lecciones l ON l.id = d.leccion_id
       JOIN cursos c ON c.id = l.curso_id
       JOIN (SELECT r.duda_id, MIN(r.fecha) AS respondida_en
             FROM respuestas r JOIN usuarias ua ON ua.id = r.usuaria_id
             WHERE ua.perfil = 'administradora'
             GROUP BY r.duda_id) x ON x.duda_id = d.id
       WHERE d.oculta = FALSE
         AND u.perfil <> 'administradora'
         AND x.respondida_en >= NOW() - INTERVAL '7 days'
       ORDER BY x.respondida_en DESC`);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/dudas/comunidad → pestaña "❓ Dudas" de la página Comunidad
// Las últimas dudas de los cursos en los que estoy inscrita (la directora: de todos).
// Mismo criterio que la RN-14: solo veo dudas de lecciones en las que puedo entrar.
router.get('/comunidad', puedeParticipar, async (req, res, next) => {
  try {
    const esAdmin = req.session.usuaria.perfil === 'administradora';
    const { rows } = await pool.query(
      `SELECT d.id, d.texto, d.foto, d.fecha, d.leccion_id, u.nombre, u.perfil,
              l.titulo AS leccion, c.titulo AS curso,
              (SELECT count(*) FROM respuestas r WHERE r.duda_id = d.id AND r.oculta = FALSE)::int AS respuestas,
              EXISTS (SELECT 1 FROM respuestas r WHERE r.duda_id = d.id AND r.destacada AND r.oculta = FALSE) AS tiene_destacada
       FROM dudas d
       JOIN usuarias u ON u.id = d.usuaria_id
       JOIN lecciones l ON l.id = d.leccion_id
       JOIN cursos c ON c.id = l.curso_id
       WHERE d.oculta = FALSE
         AND ($2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.curso_id = c.id AND i.usuaria_id = $1))
       ORDER BY d.fecha DESC
       LIMIT 50`, [req.session.usuaria.id, esAdmin]);
    res.json(rows);
  } catch (err) { next(err); }
});

// Avisos de la alumna y la profesional: respuestas nuevas a SUS dudas
const puedeTenerAvisos = requierePerfil('alumna', 'profesional');

// GET /api/dudas/mis-avisos → respuestas que todavía no ha visto
// (no cuentan las suyas propias ni lo que está oculto por un reporte)
router.get('/mis-avisos', puedeTenerAvisos, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.texto, r.fecha, r.destacada, u.nombre, u.perfil,
              d.id AS duda_id, d.texto AS duda, d.leccion_id, l.titulo AS leccion, c.titulo AS curso
       FROM respuestas r
       JOIN dudas d ON d.id = r.duda_id
       JOIN usuarias u ON u.id = r.usuaria_id
       JOIN lecciones l ON l.id = d.leccion_id
       JOIN cursos c ON c.id = l.curso_id
       WHERE d.usuaria_id = $1 AND r.usuaria_id <> $1
         AND r.leida = FALSE AND r.oculta = FALSE AND d.oculta = FALSE
       ORDER BY r.fecha DESC`, [req.session.usuaria.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/dudas/mis-avisos/leidos  { leccion_id } → marca como vistas las respuestas
// a mis dudas de esa lección (se llama al abrir la lección). Sin leccion_id → todas.
router.put('/mis-avisos/leidos', puedeTenerAvisos, async (req, res, next) => {
  try {
    const { leccion_id } = req.body;
    if (leccion_id !== undefined && !esId(leccion_id)) return res.status(400).json({ error: 'Lección no válida' });
    const { rowCount } = await pool.query(
      `UPDATE respuestas r SET leida = TRUE
       FROM dudas d
       WHERE r.duda_id = d.id AND d.usuaria_id = $1 AND r.leida = FALSE
         AND ($2::int IS NULL OR d.leccion_id = $2)`,
      [req.session.usuaria.id, leccion_id ?? null]);
    res.json({ ok: true, marcadas: rowCount });
  } catch (err) { next(err); }
});

// POST /api/dudas  (con foto opcional)
// multer guarda la foto ANTES de que comprobemos nada; por eso cada rechazo usa
// rechazar(), que además borra esa foto para que no quede suelta en uploads/.
router.post('/', puedeParticipar, subir.single('foto'), async (req, res, next) => {
  try {
    const { leccion_id } = req.body;
    if (!esId(leccion_id)) return rechazar(req, res, 400, 'Falta la lección');
    if (req.file && !req.file.mimetype.startsWith('image/'))
      return rechazar(req, res, 400, 'La foto de la duda tiene que ser una imagen');
    const { limpio, error } = revisarTexto(req.body.texto, 'duda');
    if (error) return rechazar(req, res, 400, error);

    const sinPermiso = await puedeEntrarEnLeccion(req.session.usuaria, leccion_id);
    if (sinPermiso) return rechazar(req, res, sinPermiso.estado, sinPermiso.error);

    const { rows } = await pool.query(
      'INSERT INTO dudas (leccion_id, usuaria_id, texto, foto) VALUES ($1, $2, $3, $4) RETURNING *',
      [leccion_id, req.session.usuaria.id, limpio, rutaPublica(req.file)]);
    res.status(201).json(rows[0]);
  } catch (err) {
    borrarArchivo(rutaPublica(req.file)); // si falla la base de datos, la foto tampoco se queda
    next(err);
  }
});

// POST /api/dudas/:id/respuestas
router.post('/:id/respuestas', puedeParticipar, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Duda no encontrada' });
    const { limpio, error } = revisarTexto(req.body.texto, 'respuesta');
    if (error) return res.status(400).json({ error });

    // Una duda oculta (reportada) no se puede responder hasta que la admin la revise
    const duda = await pool.query('SELECT leccion_id, usuaria_id FROM dudas WHERE id = $1 AND oculta = FALSE', [req.params.id]);
    if (!duda.rows[0]) return res.status(404).json({ error: 'Duda no encontrada' });
    const sinPermiso = await puedeEntrarEnLeccion(req.session.usuaria, duda.rows[0].leccion_id);
    if (sinPermiso) return res.status(sinPermiso.estado).json({ error: sinPermiso.error });

    // Si la autora responde a su propia duda, no tiene que avisarse a sí misma: ya va "leída"
    const leida = duda.rows[0].usuaria_id === req.session.usuaria.id;
    const { rows } = await pool.query(
      'INSERT INTO respuestas (duda_id, usuaria_id, texto, leida) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, req.session.usuaria.id, limpio, leida]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/dudas/respuestas/:id/destacar  (solo admin; una destacada por duda)
// Son dos cambios (quitar la anterior y poner la nueva): van en una TRANSACCIÓN,
// así o se hacen los dos o ninguno, y la duda nunca se queda a medias.
router.put('/respuestas/:id/destacar', requiereAdmin, async (req, res, next) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'Respuesta no encontrada' });
  const cliente = await pool.connect();
  try {
    const { rows } = await cliente.query(
      `SELECT r.duda_id FROM respuestas r JOIN dudas d ON d.id = r.duda_id
       WHERE r.id = $1 AND r.oculta = FALSE AND d.oculta = FALSE`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Respuesta no encontrada' });

    await cliente.query('BEGIN');
    await cliente.query('UPDATE respuestas SET destacada = FALSE WHERE duda_id = $1 AND destacada', [rows[0].duda_id]);
    await cliente.query('UPDATE respuestas SET destacada = TRUE WHERE id = $1', [req.params.id]);
    await cliente.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

// DELETE /api/dudas/respuestas/:id/destacar  (solo admin) → "Quitar destacada"
router.delete('/respuestas/:id/destacar', requiereAdmin, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Respuesta no encontrada' });
    const { rowCount } = await pool.query(
      'UPDATE respuestas SET destacada = FALSE WHERE id = $1 AND destacada', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Esa respuesta no estaba destacada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
