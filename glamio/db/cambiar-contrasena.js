// Cambia la contraseña de una cuenta (por ejemplo, si se olvida la de la directora académica)
// Uso: node db/cambiar-contrasena.js email@ejemplo.com "NuevaContraseña"
// Se ejecuta en la terminal del ordenador: la contraseña se guarda cifrada con bcrypt, nunca en texto.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function cambiarContrasena() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Uso: node db/cambiar-contrasena.js email "NuevaContraseña"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.log('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'UPDATE usuarias SET password = $1 WHERE email = $2 RETURNING nombre, perfil', [hash, email]);
  if (!rows[0]) console.log('No existe ninguna cuenta con ese email:', email);
  else console.log(`Contraseña cambiada ✅ (${rows[0].nombre}, ${rows[0].perfil})`);
  await pool.end();
}

cambiarContrasena().catch(err => { console.error(err.message); process.exit(1); });
