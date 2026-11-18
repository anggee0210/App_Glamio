// Crea la cuenta de administradora (solo se ejecuta una vez)
// Uso: node db/crear-admin.js "Nombre" email@ejemplo.com contraseña
require('dotenv').config();
const pool = require('./pool');
const { cifrarPassword } = require('../middleware/contrasenas'); // Argon2id
const { normalizarEmail, errorPassword } = require('../middleware/seguridad');

async function crearAdmin() {
  const [nombre, email, password] = process.argv.slice(2);
  if (!nombre || !email || !password) {
    console.log('Uso: node db/crear-admin.js "Nombre" email contraseña');
    process.exit(1);
  }
  const error = errorPassword(password); // la admin también cumple la política
  if (error) { console.log(error); process.exit(1); }
  const hash = await cifrarPassword(password);
  await pool.query(
    `INSERT INTO usuarias (nombre, email, password, perfil, email_verificado_en)
     VALUES ($1, $2, $3, 'administradora', NOW())`,
    [nombre, normalizarEmail(email), hash]
  );
  console.log('Administradora creada:', email);
  await pool.end();
}

crearAdmin().catch(err => { console.error(err.message); process.exit(1); });
