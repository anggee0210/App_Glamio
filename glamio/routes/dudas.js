// Comunidad: dudas con foto dentro de cada lección y respuestas
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin, requierePerfil } = require('../middleware/auth');
// Preguntan y responden en las lecciones quienes hacen los cursos y la administradora
const puedeParticipar = requierePerfil('alumna', 'profesional', 'administradora');
const { subir, rutaPublica } = require('../middleware/subidas');
const router = express.Router();

// GET /api/dudas?leccion=1  → dudas con sus respuestas (destacada primero)
router.get('/', async (req, res, next) => {
  try {
    const dudas = await pool.query(
      `SELECT d.*, u.nombre FROM dudas d JOIN usuarias u ON u.id = d.usuaria_id
       WHERE d.leccion_id = $1 AND d.oculta = FALSE ORDER BY d.fecha DESC`, [req.query.leccion]);

    for (const duda of dudas.rows) {
      const resp = await pool.query(
        `SELECT r.*, u.nombre, u.perfil FROM respuestas r JOIN usuarias u ON u.id = r.usuaria_id
         WHERE r.duda_id = $1 AND r.oculta = FALSE ORDER BY r.destacada DESC, r.fecha`, [duda.id]);
      duda.respuestas = resp.rows;
    }
    res.json(dudas.rows);
  } catch (err) { next(err); }
});

// POST /api/dudas  (con foto opcional)
router.post('/', puedeParticipar, subir.single('foto'), async (req, res, next) => {
  try {
    const { leccion_id, texto } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO dudas (leccion_id, usuaria_id, texto, foto) VALUES ($1, $2, $3, $4) RETURNING *',
      [leccion_id, req.session.usuaria.id, texto, rutaPublica(req.file)]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/dudas/:id/respuestas
router.post('/:id/respuestas', puedeParticipar, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'INSERT INTO respuestas (duda_id, usuaria_id, texto) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, req.session.usuaria.id, req.body.texto]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/dudas/respuestas/:id/destacar  (solo admin; una destacada por duda)
router.put('/respuestas/:id/destacar', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT duda_id FROM respuestas WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Respuesta no encontrada' });
    await pool.query('UPDATE respuestas SET destacada = FALSE WHERE duda_id = $1', [rows[0].duda_id]);
    await pool.query('UPDATE respuestas SET destacada = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
