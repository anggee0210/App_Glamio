// Cambia la contraseña de una cuenta (por ejemplo, si se olvida la de la directora académica)
// Uso: node db/cambiar-contrasena.js email@ejemplo.com "NuevaContraseña"
// Se ejecuta en la terminal del ordenador: la contraseña se guarda cifrada con Argon2id, nunca en texto.
require('dotenv').config();
const pool = require('./pool');
const { cifrarPassword } = require('../middleware/contrasenas'); // Argon2id
const { normalizarEmail, errorPassword } = require('../middleware/seguridad');

async function cambiarContrasena() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Uso: node db/cambiar-contrasena.js email "NuevaContraseña"');
    process.exit(1);
  }
  // Misma política que en la web: mínimo 8, con al menos una letra y un número
  const error = errorPassword(password);
  if (error) {
    console.log(error);
    process.exit(1);
  }
  const hash = await cifrarPassword(password);
  const { rows } = await pool.query(
    'UPDATE usuarias SET password = $1 WHERE email = $2 RETURNING id, nombre, perfil',
    [hash, normalizarEmail(email)]);
  if (!rows[0]) {
    console.log('No existe ninguna cuenta con ese email:', email);
  } else {
    // Como en la web: al cambiar la contraseña se cierran todas sus sesiones abiertas
    await pool.query('DELETE FROM sesiones WHERE usuaria_id = $1', [rows[0].id]);
    console.log(`Contraseña cambiada ✅ (${rows[0].nombre}, ${rows[0].perfil}). Sesiones cerradas.`);
  }
  await pool.end();
}

cambiarContrasena().catch(err => { console.error(err.message); process.exit(1); });
