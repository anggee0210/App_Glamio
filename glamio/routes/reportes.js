// Reportar contenido: se oculta hasta que la admin lo revise
const express = require('express');
const pool = require('../db/pool');
const { requiereLogin, requiereAdmin } = require('../middleware/auth');
const router = express.Router();

const TABLAS = { duda: ['dudas', 'oculta'], respuesta: ['respuestas', 'oculta'], trabajo: ['trabajos', 'oculto'] };

// POST /api/reportes
router.post('/', requiereLogin, async (req, res, next) => {
  try {
    const { tipo, elemento_id, motivo } = req.body;
    if (!TABLAS[tipo]) return res.status(400).json({ error: 'Tipo no válido' });
    const [tabla, campo] = TABLAS[tipo];

    await pool.query('INSERT INTO reportes (usuaria_id, tipo, elemento_id, motivo) VALUES ($1, $2, $3, $4)',
      [req.session.usuaria.id, tipo, elemento_id, motivo]);
    await pool.query(`UPDATE ${tabla} SET ${campo} = TRUE WHERE id = $1`, [elemento_id]);
    res.status(201).json({ ok: true, mensaje: 'Gracias, lo revisaremos' });
  } catch (err) { next(err); }
});

// GET /api/reportes  (solo admin) → pendientes
router.get('/', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reportes WHERE revisado = FALSE ORDER BY fecha');
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/reportes/:id  (solo admin) → { mostrar: true } vuelve a publicar el contenido
router.put('/:id', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE reportes SET revisado = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    const rep = rows[0];
    if (rep && req.body.mostrar) {
      const [tabla, campo] = TABLAS[rep.tipo];
      await pool.query(`UPDATE ${tabla} SET ${campo} = FALSE WHERE id = $1`, [rep.elemento_id]);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
