// Estadísticas de la academia (solo la administradora): cifras generales, visitas y ventas por mes
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/estadisticas
router.get('/', requiereAdmin, async (req, res, next) => {
  try {
    // 1. Cifras generales (las cuatro tarjetas de arriba del Panel)
    const cifras = (await pool.query(`
      SELECT (SELECT COUNT(*) FROM cursos)::int AS cursos,
             (SELECT COUNT(*) FROM lecciones)::int AS lecciones,
             (SELECT COUNT(*) FROM usuarias WHERE perfil IN ('alumna', 'profesional'))::int AS alumnas,
             (SELECT ROUND(AVG(estrellas), 1) FROM resenas_cursos WHERE NOT oculta) AS valoracion,
             (SELECT COUNT(*) FROM resenas_cursos WHERE NOT oculta)::int AS resenas`)).rows[0];

    // 2. Visitas: hoy, este mes, total y quién (personas distintas con sesión este mes)
    const visitas = (await pool.query(`
      SELECT COUNT(*) FILTER (WHERE fecha >= date_trunc('day', NOW()))::int AS hoy,
             COUNT(*) FILTER (WHERE fecha >= date_trunc('month', NOW()))::int AS este_mes,
             COUNT(*)::int AS total,
             COUNT(DISTINCT usuaria_id) FILTER (WHERE fecha >= date_trunc('month', NOW()))::int AS personas_este_mes
      FROM visitas`)).rows[0];

    // 3. Últimos 6 meses (incluido el actual), con 0 en los meses sin datos:
    //    visitas, cursos vendidos (inscripciones de pago) y guías vendidas, con sus ingresos
    const meses = (await pool.query(`
      WITH m AS (
        SELECT generate_series(date_trunc('month', NOW()) - INTERVAL '5 months', date_trunc('month', NOW()), INTERVAL '1 month') AS mes
      )
      SELECT to_char(m.mes, 'YYYY-MM') AS mes,
        (SELECT COUNT(*) FROM visitas v WHERE date_trunc('month', v.fecha) = m.mes)::int AS visitas,
        (SELECT COUNT(*) FROM inscripciones i WHERE date_trunc('month', i.fecha) = m.mes AND i.importe > 0)::int AS cursos_vendidos,
        (SELECT COALESCE(SUM(importe), 0) FROM inscripciones i WHERE date_trunc('month', i.fecha) = m.mes AND i.importe > 0) AS ingresos_cursos,
        (SELECT COUNT(*) FROM compras_guias g WHERE date_trunc('month', g.fecha) = m.mes AND g.importe > 0)::int AS guias_vendidas,
        (SELECT COALESCE(SUM(importe), 0) FROM compras_guias g WHERE date_trunc('month', g.fecha) = m.mes AND g.importe > 0) AS ingresos_guias
      FROM m ORDER BY m.mes`)).rows;

    // 4. Los cursos más vendidos (para saber cuáles funcionan mejor)
    const topCursos = (await pool.query(`
      SELECT c.titulo, COUNT(i.id)::int AS ventas, COALESCE(SUM(i.importe), 0) AS ingresos
      FROM cursos c JOIN inscripciones i ON i.curso_id = c.id AND i.importe > 0
      GROUP BY c.id ORDER BY ventas DESC, c.titulo LIMIT 5`)).rows;

    res.json({ cifras, visitas, meses, topCursos });
  } catch (err) { next(err); }
});

module.exports = router;
