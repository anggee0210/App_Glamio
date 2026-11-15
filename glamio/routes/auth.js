// Registro, login y logout
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const router = express.Router();

// Perfiles que se pueden registrar solas (la admin se crea con db/crear-admin.js)
const PERFILES_PUBLICOS = ['alumna', 'profesional', 'clienta'];

// POST /api/auth/registro
router.post('/registro', async (req, res, next) => {
  try {
    const { nombre, email, password, perfil } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    if (!PERFILES_PUBLICOS.includes(perfil)) return res.status(400).json({ error: 'Perfil no válido' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarias (nombre, email, password, perfil)
       VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, perfil`,
      [nombre, email, hash, perfil]
    );
    req.session.usuaria = rows[0];
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ese email ya está registrado' });
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // Sin esto, bcrypt.compare falla con un error 500 si falta la contraseña
    if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });
    const { rows } = await pool.query('SELECT * FROM usuarias WHERE email = $1', [email]);
    const usuaria = rows[0];
    if (!usuaria || !(await bcrypt.compare(password, usuaria.password))) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    req.session.usuaria = { id: usuaria.id, nombre: usuaria.nombre, email: usuaria.email, perfil: usuaria.perfil };
    res.json(req.session.usuaria);
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/yo  → usuaria con sesión
router.get('/yo', (req, res) => {
  res.json(req.session.usuaria || null);
});

module.exports = router;
