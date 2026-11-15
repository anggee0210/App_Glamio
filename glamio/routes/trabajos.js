// Muro de trabajos etiquetados por curso
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');

// Quien estudia o trabaja en GLAMIO ve todo el muro.
// La clienta (y quien entra sin cuenta) solo ve los trabajos con permiso de su autora.
const VEN_TODO_EL_MURO = ['alumna', 'profesional', 'administradora'];
const { subir, rutaPublica } = require('../middleware/subidas');
const router = express.Router();

// GET /api/trabajos?categoria=1&curso=2
router.get('/', async (req, res, next) => {
  try {
    const { categoria, curso } = req.query;
    let sql = `SELECT t.*, u.nombre, c.titulo AS curso, c.categoria_id
               FROM trabajos t JOIN usuarias u ON u.id = t.usuaria_id
               LEFT JOIN cursos c ON c.id = t.curso_id
               WHERE t.oculto = FALSE`; // oculto = reportado y pendiente de revisar
    const params = [];
    // El filtro se hace AQUÍ, en el servidor: si solo se ocultaran en la página,
    // las fotos sin permiso seguirían llegando al navegador de la clienta.
    const perfil = req.session.usuaria ? req.session.usuaria.perfil : null;
    if (!VEN_TODO_EL_MURO.includes(perfil)) sql += ' AND t.permiso_mi_estilo = TRUE';
    if (categoria) { params.push(categoria); sql += ` AND c.categoria_id = $${params.length}`; }
    if (curso) { params.push(curso); sql += ` AND t.curso_id = $${params.length}`; }
    sql += ' ORDER BY t.fecha DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/trabajos  (foto obligatoria; permiso Mi Estilo explícito)
// Solo publican quienes hacen los trabajos: alumnas y profesionales (la clienta solo mira)
router.post('/', requierePerfil('alumna', 'profesional'), subir.single('foto'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube una foto de tu trabajo' });
    const { curso_id, descripcion } = req.body;
    const permiso = req.body.permiso_mi_estilo === 'true' || req.body.permiso_mi_estilo === 'on';
    const { rows } = await pool.query(
      `INSERT INTO trabajos (usuaria_id, curso_id, foto, descripcion, permiso_mi_estilo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.session.usuaria.id, curso_id || null, rutaPublica(req.file), descripcion, permiso]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
