// =========================================
// Cifrado de contraseñas con Argon2id
//
// ¿Por qué Argon2id?
// - Ganó la Password Hashing Competition (2015) y es lo que recomienda OWASP hoy.
// - Además de tiempo de CPU, gasta MEMORIA (19 MB por intento). Eso hace muy caro
//   probar millones de contraseñas con tarjetas gráficas.
// - No corta las contraseñas largas.
//
// El hash guarda dentro el algoritmo, los parámetros y la sal, por ejemplo:
//   $argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>
// Por eso, para comprobar una contraseña, no hace falta guardar nada más.
//
// Si algún día se suben los parámetros (OPCIONES), las contraseñas guardadas con
// los antiguos se vuelven a cifrar solas en el siguiente login (necesitaRecifrar).
//
// Todo el proyecto usa SOLO estas funciones: si algún día se cambia
// el algoritmo, se cambia aquí y en ningún otro sitio.
// =========================================
const argon2 = require('argon2');

// Parámetros mínimos recomendados por OWASP para Argon2id
const OPCIONES = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB de memoria
  timeCost: 2,       // 2 pasadas
  parallelism: 1     // 1 hilo
};

// Hash "de mentira" para cuando el email no existe en el login:
// así se tarda LO MISMO exista o no la cuenta (si no, se podría adivinar por el tiempo).
// Se calcula una sola vez, la primera vez que se necesita.
let hashFalso = null;

// Calcula el hash de una contraseña (para guardarlo en la BD). Siempre Argon2id.
function cifrarPassword(password) {
  return argon2.hash(String(password), OPCIONES);
}

// Comprueba una contraseña contra un hash guardado (siempre Argon2id).
// Si hash es null (la usuaria no existe), compara con el hash falso y devuelve false.
async function comprobarPassword(password, hash) {
  if (!hash) {
    if (!hashFalso) hashFalso = await cifrarPassword('contraseña-que-no-existe-123');
    await argon2.verify(hashFalso, String(password));
    return false;
  }
  try {
    return await argon2.verify(hash, String(password));
  } catch {
    return false; // hash con formato raro: no coincide
  }
}

// ¿Este hash tiene parámetros más flojos que los actuales?
// Si es así, tras un login correcto se vuelve a cifrar con los nuevos.
function necesitaRecifrar(hash) {
  try {
    return argon2.needsRehash(hash, OPCIONES);
  } catch {
    return true;
  }
}

module.exports = { cifrarPassword, comprobarPassword, necesitaRecifrar };
