// Cambia el email con el que ENTRA la administradora.
// Uso: node db/cambiar-email-admin.js nuevo@email.com
// (Si hubiera más de una administradora, indica también su email actual:
//  node db/cambiar-email-admin.js nuevo@email.com actual@email.com)
require('dotenv').config();
const pool = require('./pool');
const { normalizarEmail, emailValido } = require('../middleware/seguridad');

async function cambiarEmail() {
  const nuevo = normalizarEmail(process.argv[2]);
  const actual = process.argv[3] ? normalizarEmail(process.argv[3]) : null;
  if (!emailValido(nuevo)) {
    console.log('Uso: node db/cambiar-email-admin.js nuevo@email.com');
    process.exit(1);
  }

  const admins = (await pool.query(
    `SELECT id, nombre, email FROM usuarias WHERE perfil = 'administradora'
     AND ($1::text IS NULL OR email = $1) ORDER BY id`, [actual])).rows;
  if (admins.length === 0) {
    console.log('No se ha encontrado la cuenta de administradora.');
  } else if (admins.length > 1) {
    console.log('Hay más de una administradora. Indica cuál con su email actual:');
    admins.forEach(a => console.log(`  ${a.nombre}: ${a.email}`));
    console.log('  node db/cambiar-email-admin.js nuevo@email.com email-actual');
  } else {
    const admin = admins[0];
    try {
      // Queda verificado (lo pones tú desde el ordenador) y se cierran sus sesiones abiertas
      await pool.query(
        'UPDATE usuarias SET email = $1, email_verificado_en = NOW() WHERE id = $2', [nuevo, admin.id]);
      await pool.query('DELETE FROM sesiones WHERE usuaria_id = $1', [admin.id]);
      console.log(`Email cambiado ✅ ${admin.nombre}: ${admin.email} → ${nuevo}`);
      console.log('Desde ahora entra con el email nuevo y su misma contraseña.');
    } catch (err) {
      if (err.code === '23505') console.log('Ese email ya lo usa otra cuenta de GLAMIO.');
      else throw err;
    }
  }
  await pool.end();
}

cambiarEmail().catch(err => { console.error(err.message); process.exit(1); });
