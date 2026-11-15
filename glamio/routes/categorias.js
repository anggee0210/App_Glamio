// Categorías (Uñas, Cabello, Cejas...)
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/categorias
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categorias ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/categorias  (solo admin)
router.post('/', requiereAdmin, async (req, res, next) => {
  try {
    const { nombre, icono } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre, icono) VALUES ($1, $2) RETURNING *', [nombre, icono]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
