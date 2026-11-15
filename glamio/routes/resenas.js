// Reseñas de cursos (solo alumnas que terminaron el curso)
const express = require('express');
const pool = require('../db/pool');
const { requiereLogin, requiereAdmin } = require('../middleware/auth');
const { subir, rutaPublica } = require('../middleware/subidas');
const router = express.Router();

// GET /api/resenas?curso=1
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.nombre, 'Alumna certificada' AS insignia
       FROM resenas_cursos r JOIN usuarias u ON u.id = r.usuaria_id
       WHERE r.curso_id = $1 ORDER BY r.fecha DESC`, [req.query.curso]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/resenas
router.post('/', requiereLogin, subir.single('foto'), async (req, res, next) => {
  try {
    const { curso_id, estrellas, comentario } = req.body;
    const usuariaId = req.session.usuaria.id;

    // Regla: solo si la inscripción está terminada
    const insc = await pool.query(
      'SELECT terminado FROM inscripciones WHERE usuaria_id = $1 AND curso_id = $2', [usuariaId, curso_id]);
    if (!insc.rows[0] || !insc.rows[0].terminado) {
      return res.status(403).json({ error: 'Solo puedes reseñar cursos que hayas terminado' });
    }

    const { rows } = await pool.query(
      `INSERT INTO resenas_cursos (usuaria_id, curso_id, estrellas, comentario, foto)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [usuariaId, curso_id, estrellas, comentario, rutaPublica(req.file)]);
    res.status(201).json(rows[0]);
  } catch (err) {
    // Regla: una reseña por alumna y curso (UNIQUE)
    if (err.code === '23505') return res.status(400).json({ error: 'Ya has reseñado este curso' });
    next(err);
  }
});

// PUT /api/resenas/:id/responder  (solo admin; las reseñas no se borran)
router.put('/:id/responder', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE resenas_cursos SET respuesta_admin = $1 WHERE id = $2 RETURNING *',
      [req.body.respuesta, req.params.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
