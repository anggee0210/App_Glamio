// =========================================
// Envío de correos de GLAMIO
//
// Dos modos (variable CORREO_MODO del .env):
// - "real":     envía correos DE VERDAD con nodemailer por SMTP (por ejemplo, Gmail).
// - "simulado": no envía nada; el correo se muestra en la consola del servidor
//               y se guarda en correos/bandeja.jsonl. Lo usa el harness (npm test)
//               para no mandar correos reales en cada prueba.
// Si no se indica, se usa "real" cuando hay datos SMTP en el .env, y si no, "simulado".
//
// CORREO_COPIA_LOCAL=true: además de enviarlo de verdad, guarda una copia en
// correos/bandeja.jsonl. Lo usa el harness para poder seguir los enlaces.
// =========================================
const fs = require('fs');
const path = require('path');

const CARPETA = path.join(__dirname, '..', 'correos');
const BANDEJA = path.join(CARPETA, 'bandeja.jsonl');

let transporte = null; // conexión SMTP (se crea la primera vez que se necesita)

function modo() {
  if (process.env.CORREO_MODO) return process.env.CORREO_MODO;
  return process.env.SMTP_HOST ? 'real' : 'simulado';
}

// Dirección de la app, para construir los enlaces de los correos
function urlApp() {
  return process.env.URL_APP || `http://localhost:${process.env.PORT || 3000}`;
}

function crearTransporte() {
  const nodemailer = require('nodemailer');
  const puerto = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465, // 465 = conexión cifrada desde el principio
    // Las 16 letras de Google se pueden pegar con espacios: aquí se quitan
    auth: { user: process.env.SMTP_USUARIO, pass: String(process.env.SMTP_PASSWORD || '').replace(/\s/g, '') },
    // UNA sola conexión que se reutiliza, y como mucho 3 correos por segundo:
    // si se abren muchas conexiones seguidas (p. ej. en npm test), Gmail las frena.
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 3
  });
}

// Plantilla HTML sencilla con los colores de GLAMIO
function plantilla(texto, enlace, textoBoton) {
  const boton = enlace
    ? `<p style="margin:24px 0"><a href="${enlace}" style="background:#d9467a;color:#fff;padding:12px 20px;
         border-radius:10px;text-decoration:none;font-weight:bold">${textoBoton}</a></p>
       <p style="color:#888;font-size:12px">Si el botón no funciona, copia este enlace:<br>${enlace}</p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
    <h1 style="color:#d9467a">GLAMIO</h1>
    <p>${texto}</p>${boton}
  </div>`;
}

// Envía un correo.
// { para, asunto, texto, enlace?, textoBoton? }
// Devuelve true si se envió, false si falló (el error se apunta en la consola).
// Guarda el correo en correos/bandeja.jsonl (un correo por línea)
function guardarEnBandeja(correo) {
  fs.mkdirSync(CARPETA, { recursive: true });
  fs.appendFileSync(BANDEJA, JSON.stringify(correo) + '\n');
}

async function enviarCorreo({ para, asunto, texto, enlace = null, textoBoton = 'Abrir' }) {
  const textoPlano = enlace ? `${texto}\n\n${enlace}` : texto;
  const correo = { para, asunto, texto: textoPlano, modo: modo(), fecha: new Date().toISOString() };

  if (modo() !== 'real') {
    console.log(`\n📧 Correo simulado para ${para}\n   Asunto: ${asunto}\n   ${textoPlano}\n`);
    guardarEnBandeja(correo);
    return true;
  }

  const mensaje = {
    from: process.env.CORREO_REMITENTE || `GLAMIO <${process.env.SMTP_USUARIO}>`,
    to: para,
    subject: asunto,
    text: textoPlano,
    html: plantilla(texto, enlace, textoBoton)
  };

  // Hasta 2 intentos: si Gmail responde "inténtalo más tarde" (códigos 4xx), esperamos y repetimos
  for (let intento = 1; intento <= 2; intento++) {
    try {
      if (!transporte) transporte = crearTransporte();
      await transporte.sendMail(mensaje);
      if (process.env.CORREO_COPIA_LOCAL === 'true') guardarEnBandeja(correo);
      return true;
    } catch (err) {
      // Temporal = Gmail dice "más tarde" (4xx) o se cortó la conexión. Un error de contraseña (535) no se repite.
      const temporal = (err.responseCode >= 400 && err.responseCode < 500) ||
        ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(err.code);
      console.error(`No se pudo enviar el correo a ${para} (intento ${intento}):`,
        err.code || '', err.response || err.message);
      if (!temporal || intento === 2) return false;
      transporte = null; // conexión nueva para el reintento
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  return false;
}

module.exports = { enviarCorreo, urlApp, BANDEJA, modo };
