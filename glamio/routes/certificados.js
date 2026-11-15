// Certificados de la usuaria con sesión (página «Mis certificados»)
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');
const router = express.Router();

// GET /api/certificados → todos los cursos que ha terminado, del más reciente al más antiguo
// Cada uno tiene su propio certificado en /certificado.html?curso=<curso_id>
router.get('/', requierePerfil('alumna', 'profesional'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id AS curso_id, c.titulo, cat.nombre AS categoria, cat.icono,
              i.id AS numero, i.terminado_en AS fecha
       FROM inscripciones i
       JOIN cursos c ON c.id = i.curso_id
       JOIN categorias cat ON cat.id = c.categoria_id
       WHERE i.usuaria_id = $1 AND i.terminado = TRUE
       ORDER BY i.terminado_en DESC`,
      [req.session.usuaria.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
