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
    if (!numeroEntre(m.coste ?? 0, 0, 10000)) return `El coste de «${String(m.nombre).trim()}» debe estar entre 0 y 10000 €`;
  }
  return null;
}

// POST /api/servicios/calcular  → solo calcula, no guarda
router.post('/calcular', (req, res) => {
  const { materiales = [], minutos = 60, precio_hora = 0, margen = 30 } = req.body;
  const error = validarDatos({ minutos, precio_hora, margen, materiales });
  if (error) return res.status(400).json({ error });
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
    for (const m of materiales) {
      await cliente.query('INSERT INTO materiales_servicio (servicio_id, nombre, coste) VALUES ($1, $2, $3)',
        [rows[0].id, String(m.nombre).trim(), Number(m.coste || 0)]);
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

module.exports = router;
