// Copia de seguridad de GLAMIO: la base de datos + las fotos, vídeos y PDF subidos.
// Uso:  npm run copia        (o  node db/copia-seguridad.js)
//
// ¿Dónde se guarda? En  Documentos\GLAMIO-copias\glamio-AAAA-MM-DD_HH-MM\
//   - glamio.sql    → toda la base de datos (cursos, alumnas, fichas, reseñas, certificado…)
//   - uploads\      → fotos y vídeos subidos
//   - privado\      → PDF de las guías
// Se puede cambiar la carpeta con COPIAS_DIR en el .env.
//
// ⚠️ La copia lleva DATOS PERSONALES (fichas de las alumnas) y contraseñas cifradas:
//    por eso se guarda FUERA del proyecto, para que nunca se suba a GitHub.
//
// Para RECUPERAR una copia: ver "Copia de seguridad" en el README.
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROYECTO = path.join(__dirname, '..');
const DESTINO_BASE = process.env.COPIAS_DIR || path.join(os.homedir(), 'Documents', 'GLAMIO-copias');

// pg_dump: si no está en el PATH, se usa el de la instalación normal de PostgreSQL 18 en Windows
function rutaPgDump() {
  const windows = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
  return process.platform === 'win32' && fs.existsSync(windows) ? windows : 'pg_dump';
}

// Fecha y hora para el nombre de la carpeta: 2026-11-18_14-05
function marcaDeTiempo() {
  const d = new Date();
  const dos = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}-${dos(d.getMinutes())}`;
}

function copiaDeSeguridad() {
  const carpeta = path.join(DESTINO_BASE, 'glamio-' + marcaDeTiempo());
  fs.mkdirSync(carpeta, { recursive: true });

  // 1. La base de datos con pg_dump.
  //    --clean --if-exists: la copia empieza borrando lo que haya, así al recuperarla queda IGUAL que hoy.
  //    La contraseña va en PGPASSWORD (variable de entorno), nunca en el comando.
  const archivoSql = path.join(carpeta, 'glamio.sql');
  execFileSync(rutaPgDump(), [
    '-h', process.env.DB_HOST || 'localhost',
    '-p', String(process.env.DB_PORT || 5432),
    '-U', process.env.DB_USER || 'postgres',
    '--clean', '--if-exists', '--no-owner', '--encoding=UTF8',
    '-f', archivoSql,
    process.env.DB_NAME || 'glamio'
  ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, stdio: ['ignore', 'inherit', 'inherit'] });

  // 2. Los archivos subidos (no están en la base de datos: la base solo guarda su ruta)
  for (const sub of ['uploads', 'privado']) {
    const origen = path.join(PROYECTO, sub);
    if (fs.existsSync(origen)) fs.cpSync(origen, path.join(carpeta, sub), { recursive: true });
  }

  const mb = (fs.statSync(archivoSql).size / 1024 / 1024).toFixed(2);
  console.log('✅ Copia de seguridad hecha en:');
  console.log('   ' + carpeta);
  console.log(`   (base de datos: ${mb} MB + fotos, vídeos y guías)`);
}

try {
  copiaDeSeguridad();
} catch (err) {
  console.error('❌ No se pudo hacer la copia:', err.message);
  console.error('   ¿Está arrancado PostgreSQL? ¿Es correcta DB_PASSWORD en el .env?');
  process.exit(1);
}
