// Fase 2 · Mi Estilo: los trabajos del muro que la clienta guarda con ♡
// El catálogo (las fotos que puede deslizar) es el mismo GET /api/trabajos de siempre:
// para la clienta ya llega filtrado (solo con permiso de la autora y no reportados).
// Aquí solo están SUS favoritos: verlos, guardar uno y quitarlo.
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');
const { esId } = require('../middleware/permisos');
const router = express.Router();

// Mi Estilo es solo de la clienta (decisión del 18/11). Los favoritos son privados:
// nadie más los ve, ni siquiera la autora del trabajo.
const soloClienta = requierePerfil('clienta');

// Un trabajo "se puede ver en Mi Estilo" si su autora dio permiso y no está reportado.
// Es la misma condición en las tres rutas, por eso va en una constante.
const VISIBLE = 't.permiso_mi_estilo = TRUE AND t.oculto = FALSE';

// GET /api/mi-estilo → mis favoritos, el último guardado primero
// Si la autora quitó el permiso o lo reportaron, la fila sigue en la tabla
// pero NO sale aquí: el filtro se hace en el servidor, no en la página.
router.get('/', soloClienta, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.foto, t.descripcion, t.fecha, u.nombre, c.titulo AS curso, f.fecha AS guardado
       FROM favoritos f
       JOIN trabajos t ON t.id = f.trabajo_id
       JOIN usuarias u ON u.id = t.usuaria_id
       LEFT JOIN cursos c ON c.id = t.curso_id
       WHERE f.usuaria_id = $1 AND ${VISIBLE}
       ORDER BY f.fecha DESC`, [req.session.usuaria.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/mi-estilo/:trabajo → guardar con ♡
// Si ya estaba guardado no es un error: ON CONFLICT DO NOTHING (así un doble clic no falla).
router.post('/:trabajo', soloClienta, async (req, res, next) => {
  try {
    const { trabajo } = req.params;
    if (!esId(trabajo)) return res.status(400).json({ error: 'Trabajo no válido' });

    // Primero comprobamos que existe y que ella lo puede ver.
    // Si no, decimos "no encontrado" (no contamos si existe uno sin permiso).
    const { rows } = await pool.query(`SELECT t.id FROM trabajos t WHERE t.id = $1 AND ${VISIBLE}`, [trabajo]);
    if (!rows[0]) return res.status(404).json({ error: 'Ese trabajo no está en Mi Estilo' });

    const r = await pool.query(
      `INSERT INTO favoritos (usuaria_id, trabajo_id) VALUES ($1, $2)
       ON CONFLICT (usuaria_id, trabajo_id) DO NOTHING`, [req.session.usuaria.id, trabajo]);
    // 201 = se ha creado; 200 = ya lo tenía
    res.status(r.rowCount ? 201 : 200).json({ mensaje: '♡ Guardado en Mi Estilo', favorito: true });
  } catch (err) {
    // P0001 = el trigger favorito_solo_clienta dijo que no (segunda barrera, por si acaso)
    if (err.code === 'P0001') return res.status(403).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/mi-estilo/:trabajo → quitar el ♡
// También vale si la autora ya quitó el permiso: la clienta puede limpiar su lista.
router.delete('/:trabajo', soloClienta, async (req, res, next) => {
  try {
    const { trabajo } = req.params;
    if (!esId(trabajo)) return res.status(400).json({ error: 'Trabajo no válido' });
    await pool.query('DELETE FROM favoritos WHERE usuaria_id = $1 AND trabajo_id = $2',
      [req.session.usuaria.id, trabajo]);
    // Quitar algo que no estaba también acaba en "no está guardado": no es un error
    res.json({ mensaje: 'Quitado de Mi Estilo', favorito: false });
  } catch (err) { next(err); }
});

module.exports = router;
