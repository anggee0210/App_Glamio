// Reportar contenido: se oculta al momento y la administradora lo revisa en el Panel
const express = require('express');
const pool = require('../db/pool');
const { requiereLogin, requiereAdmin } = require('../middleware/auth');
const { esId, puedeEntrarEnLeccion } = require('../middleware/permisos');
const router = express.Router();

// Qué tabla y qué columna "oculto/oculta" corresponde a cada tipo.
// Los nombres de tabla no pueden ir como $1, por eso solo se usan los de esta lista fija.
const TABLAS = { duda: ['dudas', 'oculta'], respuesta: ['respuestas', 'oculta'], trabajo: ['trabajos', 'oculto'],
                 resena: ['resenas_cursos', 'oculta'] };
const MOTIVOS = ['No es un trabajo propio', 'Contenido ofensivo', 'Publicidad o spam', 'Otro'];
const VEN_TODO_EL_MURO = ['alumna', 'profesional', 'administradora'];
const MAX_DETALLE = 300;

// Busca lo reportado con lo que la admin necesita para decidir (texto, foto, autora, dónde está).
// Devuelve null si ya no existe (p. ej. la autora borró su trabajo).
async function buscarContenido(tipo, id) {
  const consultas = {
    trabajo: `SELECT t.id, t.descripcion AS texto, t.foto, t.usuaria_id, t.oculto, t.permiso_mi_estilo,
                     u.nombre, c.titulo AS curso, NULL AS leccion, NULL AS leccion_id
              FROM trabajos t JOIN usuarias u ON u.id = t.usuaria_id LEFT JOIN cursos c ON c.id = t.curso_id
              WHERE t.id = $1`,
    duda: `SELECT d.id, d.texto, d.foto, d.usuaria_id, d.oculta AS oculto,
                  u.nombre, c.titulo AS curso, l.titulo AS leccion, d.leccion_id
           FROM dudas d JOIN usuarias u ON u.id = d.usuaria_id
           JOIN lecciones l ON l.id = d.leccion_id JOIN cursos c ON c.id = l.curso_id
           WHERE d.id = $1`,
    // Una respuesta cuenta como oculta también si lo está su duda (no se ve en la lección)
    respuesta: `SELECT r.id, r.texto, NULL AS foto, r.usuaria_id, (r.oculta OR d.oculta) AS oculto_para_todas, r.oculta AS oculto,
                       u.nombre, c.titulo AS curso, l.titulo AS leccion, d.leccion_id, d.texto AS duda
                FROM respuestas r JOIN dudas d ON d.id = r.duda_id JOIN usuarias u ON u.id = r.usuaria_id
                JOIN lecciones l ON l.id = d.leccion_id JOIN cursos c ON c.id = l.curso_id
                WHERE r.id = $1`,
    // Reseña de curso (RN-21): se reporta y la directora decide en el Panel
    resena: `SELECT r.id, r.comentario AS texto, r.foto, r.usuaria_id, r.oculta AS oculto, r.estrellas,
                    u.nombre, c.titulo AS curso, NULL AS leccion, NULL AS leccion_id
             FROM resenas_cursos r JOIN usuarias u ON u.id = r.usuaria_id JOIN cursos c ON c.id = r.curso_id
             WHERE r.id = $1`
  };
  const { rows } = await pool.query(consultas[tipo], [id]);
  return rows[0] || null;
}

// ¿Puede esta usuaria reportar este contenido? Solo lo que ella misma puede VER:
// si no, cualquiera podría ocultar dudas de cursos ajenos probando números.
// Devuelve null si puede, o { estado, error } si no.
async function puedeReportar(usuaria, tipo, contenido) {
  const noExiste = { estado: 404, error: 'Esa publicación no existe o ya está oculta' };
  if (!contenido || contenido.oculto || contenido.oculto_para_todas) return noExiste;
  if (contenido.usuaria_id === usuaria.id)
    return { estado: 400, error: 'No puedes reportar tu propia publicación (si quieres, bórrala)' };
  if (tipo === 'trabajo') {
    // La clienta solo ve (y por tanto solo puede reportar) las fotos con permiso
    if (!VEN_TODO_EL_MURO.includes(usuaria.perfil) && !contenido.permiso_mi_estilo) return noExiste;
    return null;
  }
  // Las reseñas se ven en la página pública del curso: puede reportarlas quien tenga sesión
  if (tipo === 'resena') return null;
  // Dudas y respuestas: hay que poder entrar en su lección (RN-14)
  return puedeEntrarEnLeccion(usuaria, contenido.leccion_id);
}

// POST /api/reportes  { tipo, elemento_id, motivo, detalle }
router.post('/', requiereLogin, async (req, res, next) => {
  const { tipo, elemento_id } = req.body;
  if (!TABLAS[tipo]) return res.status(400).json({ error: 'Tipo no válido' });
  if (!esId(elemento_id)) return res.status(404).json({ error: 'Esa publicación no existe o ya está oculta' });
  if (!MOTIVOS.includes(req.body.motivo)) return res.status(400).json({ error: 'Elige un motivo de la lista' });

  // "Otro" necesita una explicación; se guarda junto: "Otro: ..."
  let motivo = req.body.motivo;
  if (motivo === 'Otro') {
    const detalle = String(req.body.detalle ?? '').trim();
    if (!detalle) return res.status(400).json({ error: 'Cuéntanos brevemente el motivo' });
    if (detalle.length > MAX_DETALLE) return res.status(400).json({ error: `El motivo es demasiado largo (máximo ${MAX_DETALLE} caracteres)` });
    motivo = 'Otro: ' + detalle;
  }

  const cliente = await pool.connect();
  try {
    const contenido = await buscarContenido(tipo, elemento_id);
    const sinPermiso = await puedeReportar(req.session.usuaria, tipo, contenido);
    if (sinPermiso) return res.status(sinPermiso.estado).json({ error: sinPermiso.error });

    // Guardar el reporte y ocultar van juntos (transacción): o las dos cosas o ninguna
    const [tabla, campo] = TABLAS[tipo];
    await cliente.query('BEGIN');
    await cliente.query('INSERT INTO reportes (usuaria_id, tipo, elemento_id, motivo) VALUES ($1, $2, $3, $4)',
      [req.session.usuaria.id, tipo, elemento_id, motivo]);
    await cliente.query(`UPDATE ${tabla} SET ${campo} = TRUE WHERE id = $1`, [elemento_id]);
    await cliente.query('COMMIT');
    res.status(201).json({ ok: true, mensaje: 'Gracias. Lo hemos ocultado y la directora académica lo revisará.' });
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

// GET /api/reportes  (solo admin) → pendientes, AGRUPADOS por publicación
// (si tres personas reportan lo mismo, la admin lo ve una vez: "3 reportes")
router.get('/', requiereAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.tipo, r.elemento_id, count(*)::int AS veces, min(r.fecha) AS fecha,
              array_agg(r.motivo ORDER BY r.fecha) AS motivos,
              array_agg(u.nombre ORDER BY r.fecha) AS quienes
       FROM reportes r JOIN usuarias u ON u.id = r.usuaria_id
       WHERE r.revisado = FALSE
       GROUP BY r.tipo, r.elemento_id
       ORDER BY min(r.fecha)`);

    const pendientes = [];
    for (const rep of rows) {
      rep.contenido = await buscarContenido(rep.tipo, rep.elemento_id);
      if (rep.contenido) { pendientes.push(rep); continue; }
      // Ya no existe (la autora lo borró o se borró la lección): no hay nada que revisar
      await pool.query('UPDATE reportes SET revisado = TRUE WHERE tipo = $1 AND elemento_id = $2',
        [rep.tipo, rep.elemento_id]);
    }
    res.json(pendientes);
  } catch (err) { next(err); }
});

// PUT /api/reportes/:tipo/:elemento_id  (solo admin)  { mostrar: true|false }
// Cierra TODOS los reportes pendientes de esa publicación a la vez.
// mostrar = true → vuelve a publicarse · false → se queda oculta
router.put('/:tipo/:elemento_id', requiereAdmin, async (req, res, next) => {
  const { tipo, elemento_id } = req.params;
  if (!TABLAS[tipo] || !esId(elemento_id)) return res.status(404).json({ error: 'Reporte no encontrado' });
  const { mostrar } = req.body;
  if (typeof mostrar !== 'boolean') return res.status(400).json({ error: 'Indica si se vuelve a mostrar o no' });

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rowCount } = await cliente.query(
      'UPDATE reportes SET revisado = TRUE WHERE tipo = $1 AND elemento_id = $2 AND revisado = FALSE',
      [tipo, elemento_id]);
    if (rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'No hay reportes pendientes de esa publicación' });
    }
    if (mostrar) {
      const [tabla, campo] = TABLAS[tipo];
      await cliente.query(`UPDATE ${tabla} SET ${campo} = FALSE WHERE id = $1`, [elemento_id]);
    }
    await cliente.query('COMMIT');
    res.json({ ok: true, cerrados: rowCount });
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

module.exports = router;
