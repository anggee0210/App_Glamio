// =========================================
// Validación de datos y límite de intentos
// (sin librerías extra: funciones sencillas hechas a mano)
// =========================================

// Email normalizado: sin espacios y en minúsculas.
// Así "  Lucia@Gmail.com " y "lucia@gmail.com" son la misma cuenta.
function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 150;
}

// Política de contraseñas. Devuelve el mensaje de error, o null si es válida.
// - mínimo 8 caracteres
// - máximo 128 (para que nadie mande textos enormes y sature el servidor;
//   Argon2id gasta memoria en cada intento)
// - al menos una letra y un número
function errorPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password.length > 128) return 'La contraseña es demasiado larga (máximo 128 caracteres)';
  if (!/[a-zA-ZñÑ]/.test(password) || !/[0-9]/.test(password)) return 'La contraseña debe tener al menos una letra y un número';
  return null;
}

// Valida los datos del registro. Devuelve el mensaje de error, o null.
function errorRegistro({ nombre, email, password }) {
  if (!nombre || !String(nombre).trim()) return 'Falta el nombre';
  if (!emailValido(normalizarEmail(email))) return 'El email no es válido';
  return errorPassword(password);
}

// -----------------------------------------
// Límite de intentos (contra la fuerza bruta)
// Se guarda en memoria: { clave → { fallos, desde } }
// Máximo 5 fallos cada 15 minutos por IP + email.
// Se comprueba ANTES de tocar la base de datos.
// -----------------------------------------
const MAX_FALLOS = 5;
const VENTANA = 15 * 60 * 1000; // 15 minutos
const intentos = new Map();

function claveIntentos(req, email) {
  return `${req.ip}|${normalizarEmail(email)}`;
}

// ¿Está bloqueada? Devuelve los minutos que faltan, o 0 si puede intentarlo
function minutosBloqueo(clave) {
  const registro = intentos.get(clave);
  if (!registro) return 0;
  const pasado = Date.now() - registro.desde;
  if (pasado > VENTANA) { intentos.delete(clave); return 0; } // ya pasó la ventana
  if (registro.fallos < MAX_FALLOS) return 0;
  return Math.ceil((VENTANA - pasado) / 60000);
}

function apuntarFallo(clave) {
  const registro = intentos.get(clave);
  if (!registro || Date.now() - registro.desde > VENTANA) {
    intentos.set(clave, { fallos: 1, desde: Date.now() });
  } else {
    registro.fallos++;
  }
}

function olvidarFallos(clave) {
  intentos.delete(clave);
}

module.exports = {
  normalizarEmail, emailValido, errorPassword, errorRegistro,
  claveIntentos, minutosBloqueo, apuntarFallo, olvidarFallos, MAX_FALLOS
};
