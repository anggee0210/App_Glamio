// =====================================================================
// PROFESIONALES (25/11): «Mi negocio» y el directorio para las clientas
//
//  GET /api/profesionales              → directorio PÚBLICO (también sin cuenta):
//                                        ?ciudad=texto  ?categoria=id
//  GET /api/profesionales/mio          → «Mi negocio» de la profesional que ha entrado (o null)
//  PUT /api/profesionales/mio          → ella lo crea o lo cambia (solo la profesional)
//
// «Mi negocio» es lo que una clienta necesita para elegirla: ciudad y zona (nunca la dirección
// exacta), especialidades, años de experiencia, si va a domicilio, Instagram y una presentación.
// Sus datos PERSONALES (documento, dirección, teléfono) están en su ficha personal
// (routes/ficha.js), que es privada: solo la ven ella y la administradora.
// =====================================================================
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');
const router = express.Router();

// Texto limpio: sin espacios al principio/final y con los dobles reducidos ('' si no es texto)
const limpio = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// Comprueba los datos de «Mi negocio». Devuelve { error } o { negocio } ya limpio.
// La usan esta ruta, el registro (routes/auth.js) y el Panel (routes/ficha.js).
async function validarNegocio(cuerpo) {
  const b = cuerpo || {};
  const negocio = {
    nombre_negocio: limpio(b.nombre_negocio) || null,
    ciudad: limpio(b.ciudad),
    zona: limpio(b.zona) || null,
    especialidades: Array.isArray(b.especialidades) ? [...new Set(b.especialidades.map(Number))] : [],
    anios_experiencia: b.anios_experiencia === '' || b.anios_experiencia == null ? null : Number(b.anios_experiencia),
    a_domicilio: b.a_domicilio === true,
    instagram: limpio(b.instagram).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '') || null,
    sobre_mi: limpio(b.sobre_mi) || null
  };

  if (negocio.nombre_negocio && negocio.nombre_negocio.length > 100) return { error: 'El nombre del negocio es demasiado largo (máximo 100)' };
  if (negocio.ciudad.length < 2 || negocio.ciudad.length > 80) return { error: 'Escribe la ciudad donde trabajas' };
  if (negocio.zona && negocio.zona.length > 80) return { error: 'La zona es demasiado larga (máximo 80)' };
  if (!negocio.especialidades.length) return { error: 'Elige al menos una especialidad' };
  if (!negocio.especialidades.every(Number.isInteger)) return { error: 'Las especialidades no son válidas' };
  // Cada especialidad tiene que ser una categoría que exista
  const { rows } = await pool.query('SELECT id FROM categorias WHERE id = ANY($1::int[])', [negocio.especialidades]);
  if (rows.length !== negocio.especialidades.length) return { error: 'Alguna especialidad elegida no existe' };
  if (negocio.anios_experiencia !== null &&
      (!Number.isInteger(negocio.anios_experiencia) || negocio.anios_experiencia < 0 || negocio.anios_experiencia > 60))
    return { error: 'Los años de experiencia tienen que ser un número entre 0 y 60' };
  // Usuario de Instagram: letras, números, punto y guion bajo (máx. 30, como pide Instagram)
  if (negocio.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(negocio.instagram))
    return { error: 'Escribe solo tu usuario de Instagram (ej. glamio.unas)' };
  if (negocio.sobre_mi && negocio.sobre_mi.length > 400) return { error: 'La presentación es demasiado larga (máximo 400)' };
  return { negocio };
}

// Guarda «Mi negocio» YA VALIDADO. «bd» = el pool o un cliente dentro de una transacción
// (el registro crea la cuenta, la ficha y el negocio juntos). Si ya existe, se actualiza.
function escribirNegocio(bd, usuariaId, n) {
  return bd.query(
    `INSERT INTO fichas_profesionales (usuaria_id, nombre_negocio, ciudad, zona, especialidades,
       anios_experiencia, a_domicilio, instagram, sobre_mi)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (usuaria_id) DO UPDATE SET
       nombre_negocio = EXCLUDED.nombre_negocio, ciudad = EXCLUDED.ciudad, zona = EXCLUDED.zona,
       especialidades = EXCLUDED.especialidades, anios_experiencia = EXCLUDED.anios_experiencia,
       a_domicilio = EXCLUDED.a_domicilio, instagram = EXCLUDED.instagram, sobre_mi = EXCLUDED.sobre_mi`,
    [usuariaId, n.nombre_negocio, n.ciudad, n.zona, n.especialidades,
      n.anios_experiencia, n.a_domicilio, n.instagram, n.sobre_mi]);
}

// Lee «Mi negocio» de una profesional, con los NOMBRES de sus especialidades. null si no tiene.
async function leerNegocio(usuariaId) {
  const { rows } = await pool.query(
    `SELECT n.nombre_negocio, n.ciudad, n.zona, n.especialidades, n.anios_experiencia,
       n.a_domicilio, n.instagram, n.sobre_mi, n.actualizada_en,
       COALESCE((SELECT json_agg(json_build_object('id', c.id, 'nombre', c.nombre) ORDER BY c.nombre)
                 FROM categorias c WHERE c.id = ANY(n.especialidades)), '[]') AS especialidades_nombres
     FROM fichas_profesionales n WHERE n.usuaria_id = $1`, [usuariaId]);
  return rows[0] || null;
}

// ---------- Rutas ----------

// GET /api/profesionales → directorio público. Solo salen las que han rellenado «Mi negocio».
// «certificada» = ha terminado algún curso en GLAMIO (lo mismo que la insignia de su perfil).
router.get('/', async (req, res, next) => {
  try {
    const ciudad = limpio(req.query.ciudad);
    const categoria = /^\d+$/.test(String(req.query.categoria || '')) ? Number(req.query.categoria) : null;
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, n.nombre_negocio, n.ciudad, n.zona, n.anios_experiencia, n.a_domicilio, n.instagram,
         COALESCE((SELECT json_agg(c.nombre ORDER BY c.nombre) FROM categorias c WHERE c.id = ANY(n.especialidades)), '[]') AS especialidades,
         EXISTS (SELECT 1 FROM inscripciones i WHERE i.usuaria_id = u.id AND i.terminado) AS certificada,
         (SELECT COUNT(*) FROM servicios s WHERE s.usuaria_id = u.id AND s.publico)::int AS servicios,
         (SELECT MIN(s.precio_sugerido) FROM servicios s WHERE s.usuaria_id = u.id AND s.publico) AS desde,
         (SELECT t.foto FROM trabajos t WHERE t.usuaria_id = u.id AND t.permiso_mi_estilo AND NOT t.oculto
            ORDER BY t.fecha DESC LIMIT 1) AS foto
       FROM usuarias u JOIN fichas_profesionales n ON n.usuaria_id = u.id
       WHERE u.perfil = 'profesional' AND u.bloqueada_en IS NULL AND u.email_verificado_en IS NOT NULL
         AND ($1 = '' OR n.ciudad ILIKE '%' || $1 || '%' OR n.zona ILIKE '%' || $1 || '%')
         AND ($2::int IS NULL OR $2 = ANY(n.especialidades))
       ORDER BY certificada DESC, u.nombre`, [ciudad, categoria]);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/profesionales/mio → su «Mi negocio» (null si todavía no lo ha rellenado)
router.get('/mio', requierePerfil('profesional'), async (req, res, next) => {
  try {
    res.json(await leerNegocio(req.session.usuaria.id));
  } catch (err) { next(err); }
});

// PUT /api/profesionales/mio → ella lo crea o lo cambia (su negocio cambia: lo edita ella misma)
router.put('/mio', requierePerfil('profesional'), async (req, res, next) => {
  try {
    const { error, negocio } = await validarNegocio(req.body);
    if (error) return res.status(400).json({ error });
    await escribirNegocio(pool, req.session.usuaria.id, negocio);
    res.json(await leerNegocio(req.session.usuaria.id));
  } catch (err) {
    if (err.code === 'P0001') return res.status(400).json({ error: err.message }); // trigger
    next(err);
  }
});

module.exports = router;
module.exports.validarNegocio = validarNegocio;
module.exports.escribirNegocio = escribirNegocio;
module.exports.leerNegocio = leerNegocio;
