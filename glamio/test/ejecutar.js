// =========================================
// GLAMIO – Harness de pruebas
// Uso: npm test
//
// Qué hace:
// 1. Prepara la base de datos de pruebas (glamio_test) desde cero
// 2. Arranca el servidor en el puerto 3999 apuntando a esa BD
// 3. Ejecuta todas las pruebas de test/pruebas/
// 4. Apaga el servidor y muestra el resultado
// =========================================
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PUERTO, URL_BASE, BD_PRUEBAS, CORREOS_REALES, BUZON_PRUEBAS } = require('./config');
const prepararBd = require('./preparar-bd');

const raiz = path.join(__dirname, '..');

// Variables para el servidor y para las pruebas: misma conexión, pero BD de pruebas
// Correos: REALES si el .env tiene SMTP (y se guarda una copia local para seguir los enlaces),
// o simulados con "npm run test:simulado"
const entorno = {
  ...process.env, PORT: String(PUERTO), DB_NAME: BD_PRUEBAS, URL_APP: URL_BASE,
  CORREO_MODO: CORREOS_REALES ? 'real' : 'simulado',
  CORREO_COPIA_LOCAL: 'true'
};

// Espera a que el servidor responda (máximo 10 segundos)
async function esperarServidor() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${URL_BASE}/api/auth/yo`);
      if (res.ok) return;
    } catch { /* todavía no está listo */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('El servidor no arrancó en 10 segundos');
}

async function main() {
  console.log(CORREOS_REALES
    ? `📧 Correos REALES: llegarán a ${BUZON_PRUEBAS} (direcciones +prueba)`
    : '📧 Correos simulados (sin SMTP en el .env, o npm run test:simulado)');
  await prepararBd();
  // Bandeja de correos simulados vacía al empezar
  fs.rmSync(path.join(raiz, 'correos', 'bandeja.jsonl'), { force: true });

  // Arrancar el servidor (server.js) como un proceso aparte
  const servidor = spawn(process.execPath, ['server.js'], { cwd: raiz, env: entorno, stdio: 'inherit' });
  let codigo = 1;
  try {
    await esperarServidor();

    // Lista de archivos de prueba
    const carpeta = path.join(__dirname, 'pruebas');
    const archivos = fs.readdirSync(carpeta)
      .filter(f => f.endsWith('.test.js'))
      .map(f => path.join(carpeta, f));

    // Ejecutar las pruebas con el runner que trae Node (node --test), de una en una
    codigo = await new Promise(resolve => {
      const pruebas = spawn(process.execPath, ['--test', '--test-concurrency=1', ...archivos],
        { cwd: raiz, env: entorno, stdio: 'inherit' });
      pruebas.on('exit', resolve);
    });
  } finally {
    servidor.kill();
  }
  process.exit(codigo);
}

main().catch(err => { console.error('Error en el harness:', err.message); process.exit(1); });
