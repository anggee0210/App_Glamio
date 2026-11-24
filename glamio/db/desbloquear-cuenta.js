// Desbloquea una cuenta desde la terminal.
// Normalmente lo hace la administradora desde el Panel (🔒 Cuentas bloqueadas), pero
// si la bloqueada es LA PROPIA ADMINISTRADORA, no puede entrar al Panel: para eso es este script.
// Uso: node db/desbloquear-cuenta.js email@ejemplo.com
require('dotenv').config();
const pool = require('./pool');
const { normalizarEmail } = require('../middleware/seguridad');

async function desbloquear() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.log('Uso: node db/desbloquear-cuenta.js email');
    process.exit(1);
  }
  const { rows } = await pool.query(
    `UPDATE usuarias SET bloqueada_en = NULL, intentos_fallidos = 0
     WHERE email = $1 RETURNING nombre, perfil`, [normalizarEmail(email)]);
  if (!rows[0]) console.log('No existe ninguna cuenta con ese email:', email);
  else console.log(`Cuenta desbloqueada 🔓 (${rows[0].nombre}, ${rows[0].perfil})`);
  await pool.end();
}

desbloquear().catch(err => { console.error(err.message); process.exit(1); });
