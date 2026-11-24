// =========================================
// Comprobar el email al registrarse (25/11)
//
// Problema real: una profesional se registró con "…@gmai.com" (sin la "l").
// El correo de verificación salió, pero "gmai.com" es un dominio de otra empresa
// que sí recibe correos, así que no rebotó: nunca le llegó y su cuenta se quedó sin confirmar.
//
// Dos defensas:
//  1. ERRATAS de los proveedores más usados (gmai.com, gmial.com, hotmial.com, gmail.co…):
//     se pregunta "¿Quisiste decir …@gmail.com?". Si ella confirma que su email está bien,
//     se acepta (hay dominios reales parecidos, como mail.com).
//  2. DOMINIOS QUE NO RECIBEN CORREO: se pregunta al DNS si el dominio tiene servidor de
//     correo (registro MX). Si no existe o no tiene, no se puede registrar con él.
//     Solo con CORREO_MODO=real: las pruebas usan emails inventados (@pruebas.glamio).
//     Si no hay internet o el DNS tarda, NO se bloquea a nadie (mejor dejar pasar que
//     impedir registrarse por un fallo de red).
// Sin librerías: el módulo dns viene con Node.js.
// =========================================
const dns = require('dns').promises;

// Los proveedores de correo más usados por las alumnas y clientas
const PROVEEDORES = [
  'gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com',
  'yahoo.com', 'yahoo.es', 'icloud.com', 'msn.com', 'protonmail.com'
];

// Distancia de edición (Levenshtein): cuántas letras hay que poner, quitar o cambiar
// para pasar de una palabra a otra. "gmai.com" → "gmail.com" = 1.
function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
}

// Si el dominio se parece mucho (1 o 2 letras) a un proveedor conocido sin serlo,
// devuelve el email corregido. Si no, null.
function sugerencia(email) {
  const [usuario, dominio] = email.split('@');
  if (!dominio || PROVEEDORES.includes(dominio)) return null;
  let mejor = null;
  for (const proveedor of PROVEEDORES) {
    const d = distancia(dominio, proveedor);
    if (d <= 2 && (!mejor || d < mejor.d)) mejor = { proveedor, d };
  }
  return mejor ? `${usuario}@${mejor.proveedor}` : null;
}

// ¿El dominio tiene servidor de correo? true / false. Sin respuesta clara → true (no bloquear).
async function recibeCorreo(dominio) {
  try {
    const espera = new Promise((_, mal) => setTimeout(() => mal(Object.assign(new Error('lento'), { code: 'ETIMEOUT' })), 4000));
    const registros = await Promise.race([dns.resolveMx(dominio), espera]);
    // Un registro MX vacío o "." significa "este dominio NO recibe correos"
    return registros.some(r => r.exchange && r.exchange !== '.');
  } catch (err) {
    if (['ENOTFOUND', 'ENODATA', 'ENONAME'].includes(err.code)) return false; // el dominio no existe o no tiene MX
    // La consulta MX no pudo salir (en Windows a veces Node pregunta a 127.0.0.1 y nadie contesta).
    // Segundo intento con el DNS del sistema (dns.lookup): solo dice si el dominio EXISTE.
    return existeDominio(dominio);
  }
}

// ¿Existe el dominio? Usa el mismo DNS que el navegador. No existe → false; cualquier otra duda → true
async function existeDominio(dominio) {
  try {
    await dns.lookup(dominio);
    return true;
  } catch (err) {
    return !['ENOTFOUND', 'ENODATA', 'ENONAME'].includes(err.code);
  }
}

// Devuelve {} si el email vale, o { error, sugerencia? } si hay que avisar.
// confirmado = true cuando ella ya dijo "mi email está bien" a la sugerencia.
async function comprobarEmail(email, confirmado = false) {
  const corregido = sugerencia(email);
  if (corregido && !confirmado) {
    const [, dominio] = email.split('@'), bueno = corregido.split('@')[1];
    return { error: `La parte del email después de la @ («${dominio}») parece mal escrita. ¿Quisiste decir ${corregido}? Si no se corrige, no te llegará el correo para activar la cuenta.`, sugerencia: corregido, dominio_bueno: bueno };
  }
  if (process.env.CORREO_MODO === 'simulado') return {};
  const dominio = email.split('@')[1];
  if (!(await recibeCorreo(dominio))) {
    return { error: `La parte del email después de la @ («${dominio}») no existe o no recibe correos. Revísala: ahí te llegará el enlace para activar la cuenta.` };
  }
  return {};
}

module.exports = { comprobarEmail, sugerencia, distancia };
