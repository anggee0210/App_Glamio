// Crea la cuenta de administradora (solo se ejecuta una vez)
// Uso: node db/crear-admin.js "Nombre" email@ejemplo.com contraseña
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function crearAdmin() {
  const [nombre, email, password] = process.argv.slice(2);
  if (!nombre || !email || !password) {
    console.log('Uso: node db/crear-admin.js "Nombre" email contraseña');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO usuarias (nombre, email, password, perfil)
     VALUES ($1, $2, $3, 'administradora')`,
    [nombre, email, hash]
  );
  console.log('Administradora creada:', email);
  await pool.end();
}

crearAdmin().catch(err => { console.error(err.message); process.exit(1); });
