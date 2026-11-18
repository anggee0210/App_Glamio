// Prepara la base de datos de pruebas desde cero:
// 1. crea la BD glamio_test si no existe
// 2. ejecuta db/schema.sql (borra y crea las tablas)
// 3. ejecuta db/seed.sql (categorías, cursos y lecciones de ejemplo)
// 4. crea la administradora de pruebas
const fs = require('fs');
const path = require('path');
const { cifrarPassword } = require('../middleware/contrasenas');
const { Client } = require('pg');
const { BD_PRUEBAS, ADMIN } = require('./config');

// Datos de conexión del .env, cambiando solo el nombre de la base de datos
function conexion(nombreBd) {
  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: nombreBd
  };
}

async function prepararBd() {
  // Seguridad: nunca borrar una BD que no sea de pruebas
  if (!BD_PRUEBAS.includes('test')) {
    throw new Error(`La BD de pruebas debe llevar "test" en el nombre (ahora es "${BD_PRUEBAS}")`);
  }

  // 1. Crear la BD de pruebas si no existe (nos conectamos a la BD "postgres", que siempre existe)
  const admin = new Client(conexion('postgres'));
  await admin.connect();
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [BD_PRUEBAS]);
  if (!existe.rows[0]) {
    await admin.query(`CREATE DATABASE ${BD_PRUEBAS}`);
    console.log(`Base de datos ${BD_PRUEBAS} creada`);
  }
  await admin.end();

  // 2 y 3. Tablas y datos de ejemplo
  const bd = new Client(conexion(BD_PRUEBAS));
  await bd.connect();
  const carpetaDb = path.join(__dirname, '..', 'db');
  await bd.query(fs.readFileSync(path.join(carpetaDb, 'schema.sql'), 'utf8'));
  await bd.query(fs.readFileSync(path.join(carpetaDb, 'seed.sql'), 'utf8'));

  // 4. Administradora de pruebas
  const hash = await cifrarPassword(ADMIN.password);
  await bd.query(
    `INSERT INTO usuarias (nombre, email, password, perfil, email_verificado_en)
     VALUES ($1, $2, $3, 'administradora', NOW())`,
    [ADMIN.nombre, ADMIN.email, hash]);
  await bd.end();

  console.log(`Base de datos ${BD_PRUEBAS} lista (esquema + datos de ejemplo + admin)`);
}

module.exports = prepararBd;

// Si se ejecuta directamente: node test/preparar-bd.js
if (require.main === module) {
  prepararBd().catch(err => { console.error(err.message); process.exit(1); });
}
