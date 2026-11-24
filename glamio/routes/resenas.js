// Reseñas de cursos (solo quien terminó el curso; una por persona y curso)
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin, requierePerfil } = require('../middleware/auth');
const { subir, rutaPublica, rechazar, borrarArchivo } = require('../middleware/subidas');
const { esId } = require('../middleware/permisos');
const router = express.Router();

// Reseñan quienes hacen los cursos (la clienta no hace cursos; la directora responde)
const puedeResenar = requierePerfil('alumna', 'profesional');
const MAX_TEXTO = 1000;

// GET /api/resenas?curso=1  → reseñas visibles (las reportadas no salen hasta que se revisen)
// La insignia depende del perfil, igual que en el certificado.
router.get('/', async (req, res, next) => {
  try {
    if (!esId(req.query.curso)) return res.status(400).json({ error: 'Falta el curso' });
    const { rows } = await pool.query(
      `SELECT r.*, u.nombre,
              CASE WHEN u.perfil = 'profesional' THEN 'Profesional certificada' ELSE 'Alumna certificada' END AS insignia
       FROM resenas_cursos r JOIN usuarias u ON u.id = r.usuaria_id
       WHERE r.curso_id = $1 AND r.oculta = FALSE
       ORDER BY r.fecha DESC`, [req.query.curso]);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/resenas/sin-responder  (solo admin) → para la campana 🔔
// Solo las de 1 a 3 estrellas: son las que la RN-21 pide responder (decisión del proyecto).
router.get('/sin-responder', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.curso_id, r.estrellas, r.comentario, r.fecha, u.nombre, c.titulo AS curso
       FROM resenas_cursos r JOIN usuarias u ON u.id = r.usuaria_id JOIN cursos c ON c.id = r.curso_id
       WHERE r.estrellas <= 3 AND r.respuesta_admin IS NULL AND r.oculta = FALSE
       ORDER BY r.fecha DESC`);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/resenas  (foto opcional)
// multer guarda la foto antes de comprobar nada: cada rechazo usa rechazar(), que la borra.
router.post('/', puedeResenar, subir.single('foto'), async (req, res, next) => {
  try {
    const { curso_id } = req.body;
    if (!esId(curso_id)) return rechazar(req, res, 400, 'Falta el curso');
    // RN-20: de 1 a 5 estrellas, número entero (la base también lo comprueba con un CHECK)
    const estrellas = Number(req.body.estrellas);
    if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5)
      return rechazar(req, res, 400, 'Elige de 1 a 5 estrellas');
    const comentario = String(req.body.comentario ?? '').trim();
    if (comentario.length > MAX_TEXTO)
      return rechazar(req, res, 400, `El comentario es demasiado largo (máximo ${MAX_TEXTO} caracteres)`);
    if (req.file && !req.file.mimetype.startsWith('image/'))
      return rechazar(req, res, 400, 'La foto de la reseña tiene que ser una imagen');

    // RN-18: solo si la inscripción está terminada (y la base lo vuelve a comprobar con un trigger)
    const insc = await pool.query(
      'SELECT terminado FROM inscripciones WHERE usuaria_id = $1 AND curso_id = $2', [req.session.usuaria.id, curso_id]);
    if (!insc.rows[0] || !insc.rows[0].terminado)
      return rechazar(req, res, 403, 'Solo puedes reseñar cursos que hayas terminado');

    const { rows } = await pool.query(
      `INSERT INTO resenas_cursos (usuaria_id, curso_id, estrellas, comentario, foto)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.session.usuaria.id, curso_id, estrellas, comentario || null, rutaPublica(req.file)]);
    res.status(201).json(rows[0]);
  } catch (err) {
    // RN-19: una reseña por persona y curso (UNIQUE) → 409 "conflicto", como dice reglas-de-negocio.md
    if (err.code === '23505') return rechazar(req, res, 409, 'Ya has reseñado este curso');
    // P0001 = el trigger dijo que no (por si alguna vez la comprobación de arriba no lo pilla)
    if (err.code === 'P0001') return rechazar(req, res, 403, err.message);
    borrarArchivo(rutaPublica(req.file));
    next(err);
  }
});

// PUT /api/resenas/:id/responder  (solo admin) { respuesta }
// Sirve para responder por primera vez y para editar la respuesta. Las reseñas no se borran (RN-21).
router.put('/:id/responder', requiereAdmin, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Reseña no encontrada' });
    const respuesta = String(req.body.respuesta ?? '').trim();
    if (!respuesta) return res.status(400).json({ error: 'Escribe tu respuesta' });
    if (respuesta.length > MAX_TEXTO) return res.status(400).json({ error: `La respuesta es demasiado larga (máximo ${MAX_TEXTO} caracteres)` });
    const { rows } = await pool.query(
      'UPDATE resenas_cursos SET respuesta_admin = $1 WHERE id = $2 RETURNING *', [respuesta, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reseña no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/resenas/:id  → la autora borra SU reseña (es su opinión y su foto: RGPD).
// No puede editarla: así la respuesta de la directora nunca contesta a un texto que ya cambió.
router.delete('/:id', puedeResenar, async (req, res, next) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'Esa reseña no existe o no es tuya' });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      'DELETE FROM resenas_cursos WHERE id = $1 AND usuaria_id = $2 RETURNING foto', [req.params.id, req.session.usuaria.id]);
    if (!rows[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Esa reseña no existe o no es tuya' });
    }
    // Los reportes no tienen clave foránea: quitamos a mano los de esta reseña
    await cliente.query("DELETE FROM reportes WHERE tipo = 'resena' AND elemento_id = $1", [req.params.id]);
    await cliente.query('COMMIT');
    borrarArchivo(rows[0].foto); // la foto, solo cuando la base ya lo ha confirmado
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

module.exports = router;
