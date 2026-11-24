// Fase 2 · Perfil público de quien hace los trabajos (alumna y profesional)
// Lo puede ver CUALQUIERA, también sin cuenta (decisión del 18/11), así que aquí solo
// salen datos públicos: nombre, insignia, cursos terminados, trabajos y los servicios
// que ella marcó como públicos. Nunca el email ni el desglose de costes.
const express = require('express');
const pool = require('../db/pool');
const { esId } = require('../middleware/permisos');
const router = express.Router();

// Perfiles que tienen página pública (la clienta y la administradora no publican trabajos)
const CON_PERFIL = ['alumna', 'profesional'];
// Igual que en el muro (routes/trabajos.js): quien estudia o trabaja en GLAMIO ve todas las fotos;
// la clienta y quien no tiene cuenta, solo las que tienen permiso de su autora.
const VEN_TODO_EL_MURO = ['alumna', 'profesional', 'administradora'];

// GET /api/perfil/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Mismo mensaje si el id es raro, si no existe o si es una clienta/administradora:
    // así no se puede averiguar qué cuentas existen.
    const noExiste = () => res.status(404).json({ error: 'Este perfil no existe' });
    if (!esId(id)) return noExiste();

    const persona = (await pool.query(
      'SELECT id, nombre, perfil, creada_en FROM usuarias WHERE id = $1', [id])).rows[0];
    if (!persona || !CON_PERFIL.includes(persona.perfil)) return noExiste();

    // Cursos terminados en GLAMIO (lo mismo que dice su certificado)
    const cursos = (await pool.query(
      `SELECT c.id, c.titulo, cat.nombre AS categoria, cat.icono, i.terminado_en
       FROM inscripciones i
       JOIN cursos c ON c.id = i.curso_id
       LEFT JOIN categorias cat ON cat.id = c.categoria_id
       WHERE i.usuaria_id = $1 AND i.terminado = TRUE
       ORDER BY i.terminado_en DESC NULLS LAST`, [id])).rows;

    // Trabajos: nunca los reportados; y la regla del permiso según quién mira
    const quienMira = req.session.usuaria ? req.session.usuaria.perfil : null;
    const soloConPermiso = !VEN_TODO_EL_MURO.includes(quienMira);
    const trabajos = (await pool.query(
      `SELECT t.id, t.foto, t.descripcion, t.fecha, t.permiso_mi_estilo, c.titulo AS curso
       FROM trabajos t LEFT JOIN cursos c ON c.id = t.curso_id
       WHERE t.usuaria_id = $1 AND t.oculto = FALSE
         ${soloConPermiso ? 'AND t.permiso_mi_estilo = TRUE' : ''}
       ORDER BY t.fecha DESC`, [id])).rows;

    // Servicios: solo los que ella marcó como públicos, y sin los costes de materiales
    const servicios = (await pool.query(
      `SELECT s.id, s.nombre, s.minutos, s.precio_sugerido, cat.nombre AS categoria, cat.icono
       FROM servicios s LEFT JOIN categorias cat ON cat.id = s.categoria_id
       WHERE s.usuaria_id = $1 AND s.publico = TRUE
       ORDER BY s.nombre`, [id])).rows;

    // Insignia: "certificada" solo si de verdad ha terminado algún curso
    const nombrePerfil = persona.perfil === 'profesional' ? 'Profesional' : 'Alumna';
    res.json({
      id: persona.id,
      nombre: persona.nombre,
      perfil: persona.perfil,
      insignia: cursos.length ? `${nombrePerfil} certificada` : nombrePerfil,
      miembro_desde: persona.creada_en,
      cursos, trabajos, servicios
    });
  } catch (err) { next(err); }
});

module.exports = router;
