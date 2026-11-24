// Calculadora "Calcular mi precio" y servicios propios
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');
// La calculadora es para quien cobra servicios (la clienta no la usa)
const requiereCalculadora = requierePerfil('alumna', 'profesional', 'administradora');
const router = express.Router();

// ¿Viene el material con "precio del producto" y "servicios que salen"? (forma nueva, 24/11)
const conEnvase = (m) => m.precio_envase !== undefined && m.precio_envase !== '';

// Coste de UN material en UNA sesión.
// Forma nueva: lo que costó el producto entero ÷ los servicios que salen de él.
//   Ej.: un esmalte de 12 € da para 30 servicios → 12 / 30 = 0,40 € por sesión.
// Forma antigua (servicios guardados antes del 24/11): el coste por servicio escrito a mano.
function costePorSesion(m) {
  if (conEnvase(m)) return Number(m.precio_envase) / Number(m.servicios_envase);
  return Number(m.coste || 0);
}

const redondear = (n) => Math.round(n * 100) / 100;

// Fórmula: (materiales por sesión + mano de obra) * (1 + margen/100)
// Devuelve también el desglose, para enseñarlo en la calculadora.
function desglosar(materiales, minutos, precioHora, margen) {
  const costeMateriales = materiales.reduce((suma, m) => suma + costePorSesion(m), 0);
  const manoObra = (Number(minutos) / 60) * Number(precioHora);
  const total = (costeMateriales + manoObra) * (1 + Number(margen) / 100);
  return {
    coste_materiales: redondear(costeMateriales),
    mano_obra: redondear(manoObra),
    margen_euros: redondear(total - costeMateriales - manoObra),
    precio_sugerido: redondear(total)
  };
}
const calcularPrecio = (...datos) => desglosar(...datos).precio_sugerido;

// ¿Es un número válido entre min y max? (rechaza texto, vacío y negativos)
function numeroEntre(valor, min, max) {
  if (valor === '' || valor === null || valor === undefined) return false;
  const n = Number(valor);
  return Number.isFinite(n) && n >= min && n <= max;
}

// Comprueba los datos de la calculadora (RN-12: ningún valor negativo).
// Devuelve el texto del error, o null si todo está bien.
// Los máximos evitan cifras absurdas que no caben en las columnas NUMERIC.
function validarDatos({ minutos, precio_hora, margen, materiales }) {
  if (!Number.isInteger(Number(minutos)) || !numeroEntre(minutos, 1, 1440))
    return 'Los minutos deben ser un número entero entre 1 y 1440 (24 h)';
  if (!numeroEntre(precio_hora, 0, 1000)) return 'El valor de tu hora debe estar entre 0 y 1000 €';
  if (!numeroEntre(margen, 0, 500)) return 'El margen debe estar entre 0 y 500 %';
  if (!Array.isArray(materiales)) return 'La lista de materiales no es válida';
  for (const m of materiales) {
    if (!m || !String(m.nombre || '').trim()) return 'Cada material necesita un nombre';
    if (String(m.nombre).trim().length > 100) return 'El nombre de un material es demasiado largo (máx. 100)';
    const nombre = String(m.nombre).trim();
    if (conEnvase(m)) {
      if (!numeroEntre(m.precio_envase, 0, 10000))
        return `El precio de «${nombre}» debe estar entre 0 y 10000 €`;
      if (!Number.isInteger(Number(m.servicios_envase)) || !numeroEntre(m.servicios_envase, 1, 10000))
        return `Indica para cuántos servicios te da «${nombre}» (un número entero de 1 a 10000)`;
    } else if (!numeroEntre(m.coste ?? 0, 0, 10000)) {
      return `El coste de «${nombre}» debe estar entre 0 y 10000 €`;
    }
  }
  return null;
}

// POST /api/servicios/calcular  → solo calcula, no guarda
router.post('/calcular', (req, res) => {
  const { materiales = [], minutos = 60, precio_hora = 0, margen = 30 } = req.body;
  const error = validarDatos({ minutos, precio_hora, margen, materiales });
  if (error) return res.status(400).json({ error });
  res.json(desglosar(materiales, minutos, precio_hora, margen)); // precio + desglose
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
  const { categoria_id, curso_id, minutos, precio_hora, margen, materiales = [] } = req.body;
  const nombre = String(req.body.nombre || '').trim();

  // Primero comprobamos; así no abrimos conexión para nada
  if (!nombre) return res.status(400).json({ error: 'Pon un nombre al servicio' });
  if (nombre.length > 100) return res.status(400).json({ error: 'El nombre del servicio es demasiado largo (máx. 100)' });
  const error = validarDatos({ minutos, precio_hora, margen, materiales });
  if (error) return res.status(400).json({ error });

  const precio = calcularPrecio(materiales, minutos, precio_hora, margen);
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO servicios (usuaria_id, categoria_id, curso_id, nombre, minutos, precio_hora, margen, precio_sugerido)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.session.usuaria.id, categoria_id || null, curso_id || null, nombre, minutos, precio_hora, margen, precio]);
    // Se guarda el precio del producto, los servicios que salen y el coste por sesión ya calculado
    for (const m of materiales) {
      await cliente.query(
        `INSERT INTO materiales_servicio (servicio_id, nombre, coste, precio_envase, servicios_envase)
         VALUES ($1, $2, $3, $4, $5)`,
        [rows[0].id, String(m.nombre).trim(), costePorSesion(m),
          conEnvase(m) ? Number(m.precio_envase) : null, conEnvase(m) ? Number(m.servicios_envase) : null]);
    }
    await cliente.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await cliente.query('ROLLBACK');
    // 23503 = la categoría o el curso no existen; 22P02 = id que no es un número
    if (err.code === '23503' || err.code === '22P02')
      return res.status(400).json({ error: 'La categoría o el curso elegidos no existen' });
    next(err);
  } finally {
    cliente.release();
  }
});

// DELETE /api/servicios/:id
router.delete('/:id', requiereCalculadora, async (req, res, next) => {
  try {
    // usuaria_id en el WHERE: nadie puede borrar servicios de otra persona
    const { rowCount } = await pool.query('DELETE FROM servicios WHERE id = $1 AND usuaria_id = $2',
      [req.params.id, req.session.usuaria.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Ese servicio no existe o no es tuyo' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Ese servicio no existe o no es tuyo' });
    next(err);
  }
});

// PUT /api/servicios/:id/publico  { publico: true | false }
// Fase 2 · Perfil público: ella decide si el servicio sale en su perfil (nombre, duración y precio).
router.put('/:id/publico', requiereCalculadora, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Ese servicio no existe o no es tuyo' });
    const { publico } = req.body;
    if (typeof publico !== 'boolean') return res.status(400).json({ error: 'Indica si se muestra en tu perfil (sí o no)' });
    // usuaria_id en el WHERE: nadie puede publicar el precio de otra persona
    const { rows } = await pool.query(
      'UPDATE servicios SET publico = $1 WHERE id = $2 AND usuaria_id = $3 RETURNING id, publico',
      [publico, req.params.id, req.session.usuaria.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ese servicio no existe o no es tuyo' });
    res.json({ ...rows[0], mensaje: publico ? '👁 Ahora sale en tu perfil público' : '🔒 Ya no sale en tu perfil' });
  } catch (err) { next(err); }
});

module.exports = router;
