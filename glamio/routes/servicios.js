// Calculadora "Calcular mi precio" y servicios propios
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');
// La calculadora es para quien cobra servicios (la clienta no la usa)
const requiereCalculadora = requierePerfil('alumna', 'profesional', 'administradora');
const router = express.Router();

// Fórmula: (materiales + mano de obra) * (1 + margen/100)
function calcularPrecio(materiales, minutos, precioHora, margen) {
  const costeMateriales = materiales.reduce((suma, m) => suma + Number(m.coste || 0), 0);
  const manoObra = (Number(minutos) / 60) * Number(precioHora);
  const total = (costeMateriales + manoObra) * (1 + Number(margen) / 100);
  return Math.round(total * 100) / 100;
}

// POST /api/servicios/calcular  → solo calcula, no guarda
router.post('/calcular', (req, res) => {
  const { materiales = [], minutos = 60, precio_hora = 0, margen = 30 } = req.body;
  res.json({ precio_sugerido: calcularPrecio(materiales, minutos, precio_hora, margen) });
});

// GET /api/servicios  → mis servicios
router.get('/', requiereCalculadora, async (req, res, next) => {
  try {
    const servicios = await pool.query(
      'SELECT * FROM servicios WHERE usuaria_id = $1 ORDER BY id', [req.session.usuaria.id]);
    for (const s of servicios.rows) {
      const mat = await pool.query('SELECT * FROM materiales_servicio WHERE servicio_id = $1', [s.id]);
      s.materiales = mat.rows;
    }
    res.json(servicios.rows);
  } catch (err) { next(err); }
});

// POST /api/servicios  → guarda servicio con sus materiales
router.post('/', requiereCalculadora, async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { nombre, categoria_id, curso_id, minutos, precio_hora, margen, materiales = [] } = req.body;
    const precio = calcularPrecio(materiales, minutos, precio_hora, margen);

    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO servicios (usuaria_id, categoria_id, curso_id, nombre, minutos, precio_hora, margen, precio_sugerido)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.session.usuaria.id, categoria_id || null, curso_id || null, nombre, minutos, precio_hora, margen, precio]);
    for (const m of materiales) {
      await cliente.query('INSERT INTO materiales_servicio (servicio_id, nombre, coste) VALUES ($1, $2, $3)',
        [rows[0].id, m.nombre, m.coste]);
    }
    await cliente.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

// DELETE /api/servicios/:id
router.delete('/:id', requiereCalculadora, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM servicios WHERE id = $1 AND usuaria_id = $2',
      [req.params.id, req.session.usuaria.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
