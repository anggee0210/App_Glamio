// Configuración común del harness de pruebas.
// Las pruebas usan SIEMPRE una base de datos aparte (glamio_test),
// para no tocar nunca los datos reales de glamio.
require('dotenv').config();

const PUERTO_PRUEBAS = process.env.PORT_TEST || 3999;

module.exports = {
  PUERTO: PUERTO_PRUEBAS,
  URL_BASE: `http://localhost:${PUERTO_PRUEBAS}`,
  BD_PRUEBAS: process.env.DB_NAME_TEST || 'glamio_test',

  // Correos REALES en las pruebas si el .env tiene SMTP configurado
  // (npm run test:simulado los desactiva).
  CORREOS_REALES: Boolean(process.env.SMTP_HOST) && process.env.CORREO_PRUEBAS !== 'simulado',
  // Buzón que recibe los correos de prueba (por defecto, el mismo de SMTP_USUARIO).
  // Se usan direcciones "buzon+algo@gmail.com": Gmail las entrega todas en ese buzón.
  BUZON_PRUEBAS: (process.env.CORREO_PRUEBAS_BUZON || process.env.SMTP_USUARIO || '').toLowerCase(),

  // Administradora que se crea automáticamente en la BD de pruebas
  ADMIN: {
    nombre: 'Admin Pruebas',
    email: 'admin@pruebas.glamio',
    password: 'admin1234'
  }
};
