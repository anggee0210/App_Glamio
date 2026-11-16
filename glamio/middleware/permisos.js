// Comprobaciones que usan varias rutas (dudas, reportes, trabajos).
// Están aquí para no copiar el mismo código en cada archivo.
const pool = require('../db/pool');

// ¿Es un id válido? (un número entero positivo que cabe en una columna INT)
function esId(valor) {
  return /^\d+$/.test(String(valor)) && Number(valor) > 0 && Number(valor) <= 2147483647;
}

// RN-14: en una lección solo participan las inscritas en su curso (y la administradora).
// Devuelve null si puede, o { estado, error } si no.
async function puedeEntrarEnLeccion(usuaria, leccionId) {
  const { rows } = await pool.query(
    `SELECT l.id, (i.id IS NOT NULL) AS inscrita
     FROM lecciones l
     LEFT JOIN inscripciones i ON i.curso_id = l.curso_id AND i.usuaria_id = $2
     WHERE l.id = $1`, [leccionId, usuaria.id]);
  if (!rows[0]) return { estado: 404, error: 'Lección no encontrada' };
  if (!rows[0].inscrita && usuaria.perfil !== 'administradora')
    return { estado: 403, error: 'Inscríbete en el curso para participar en sus dudas' };
  return null;
}

module.exports = { esId, puedeEntrarEnLeccion };
