// Funciones de ayuda para las pruebas.
// "Sesion" simula un navegador: guarda la cookie de sesión (glamio_sesion)
// y la envía en cada petición, igual que hace el navegador de verdad.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { URL_BASE, ADMIN, CORREOS_REALES, BUZON_PRUEBAS } = require('./config');

const BANDEJA = path.join(__dirname, '..', 'correos', 'bandeja.jsonl');

class Sesion {
  constructor() {
    this.cookie = null;
  }

  // Hace una petición a la API y devuelve { estado, datos }
  async pedir(metodo, url, cuerpo) {
    const opciones = { method: metodo, headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    if (this.cookie) opciones.headers.Cookie = this.cookie;

    const res = await fetch(URL_BASE + url, opciones);

    // Si el servidor manda una cookie nueva, la guardamos
    // (si llegan varias con el mismo nombre, vale la última, como en el navegador)
    for (const c of res.headers.getSetCookie()) this.cookie = c.split(';')[0];

    const datos = await res.json().catch(() => null);
    return { estado: res.status, datos };
  }

  get(url) { return this.pedir('GET', url); }
  post(url, cuerpo = {}) { return this.pedir('POST', url, cuerpo); }
  put(url, cuerpo = {}) { return this.pedir('PUT', url, cuerpo); }
}

// Email único para cada usuaria de prueba (así las pruebas no chocan entre sí).
// Con correos REALES: "tucorreo+alumna.1700000000.1@gmail.com" → Gmail lo entrega en tu buzón.
// Con correos simulados: "alumna.1700000000.1@pruebas.glamio".
let contador = 0;
function emailUnico(perfil) {
  contador++;
  const etiqueta = `${perfil}.${Date.now()}.${contador}`.toLowerCase();
  if (CORREOS_REALES) {
    const [usuario, dominio] = BUZON_PRUEBAS.split('@');
    return `${usuario}+${etiqueta}@${dominio}`;
  }
  return `${etiqueta}@pruebas.glamio`;
}

// Lee el último correo enviado a un email (o null si no hay)
function ultimoCorreo(email) {
  if (!fs.existsSync(BANDEJA)) return null;
  const correos = fs.readFileSync(BANDEJA, 'utf8').trim().split('\n')
    .filter(Boolean).map(linea => JSON.parse(linea))
    .filter(c => c.para === email);
  return correos[correos.length - 1] || null;
}

// Saca el token del enlace de un correo (...?token=XXXX)
function tokenDelCorreo(correo) {
  const encontrado = correo && correo.texto.match(/token=([A-Za-z0-9_-]+)/);
  return encontrado ? encontrado[1] : null;
}

// Desde el 24/11 la alumna manda su ficha al registrarse. Cada una necesita un DNI distinto
// (el documento es UNIQUE). Cada archivo de pruebas corre en su propio proceso, así que se
// parte del número del proceso para que dos archivos no repitan DNI.
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
let siguienteDni = 30000000 + (process.pid % 60000) * 1000;
function fichaDePrueba(cambios = {}) {
  const n = siguienteDni++;
  return {
    nombre_completo: 'Prueba Alumna García',
    pais_nacimiento: 'ES',
    ciudad_nacimiento: 'Madrid',
    numero_documento: String(n) + LETRAS_DNI[n % 23],
    fecha_nacimiento: '1998-03-15',
    direccion: 'Calle de Prueba 1, Madrid',
    telefono: '600111222',
    ...cambios
  };
}

// Registra una usuaria SIN confirmar el email. Devuelve sus datos y la sesión (sin entrar).
async function registrarSinVerificar(perfil = 'alumna') {
  const sesion = new Sesion();
  const datos = { nombre: `Prueba ${perfil}`, email: emailUnico(perfil), password: 'clave1234', perfil };
  if (perfil === 'alumna') datos.ficha = fichaDePrueba();
  const res = await sesion.post('/api/auth/registro', datos);
  if (res.estado !== 201) throw new Error(`No se pudo registrar: ${JSON.stringify(res.datos)}`);
  // El correo de verificación tiene que haber salido (con correos reales: Gmail lo aceptó)
  assert.equal(res.datos.correo_enviado, true, 'el correo de verificación no se pudo enviar');
  sesion.usuaria = { ...res.datos, password: datos.password };
  return sesion;
}

// Registra una usuaria, confirma su email con el enlace del correo y queda dentro
async function nuevaUsuaria(perfil = 'alumna') {
  const sesion = await registrarSinVerificar(perfil);
  const token = tokenDelCorreo(ultimoCorreo(sesion.usuaria.email));
  const res = await sesion.post('/api/auth/verificar-email', { token });
  if (res.estado !== 200) throw new Error(`No se pudo verificar: ${JSON.stringify(res.datos)}`);
  return sesion;
}

// Devuelve una sesión de la administradora de pruebas
async function sesionAdmin() {
  const sesion = new Sesion();
  const res = await sesion.post('/api/auth/login', { email: ADMIN.email, password: ADMIN.password });
  if (res.estado !== 200) throw new Error('No se pudo entrar como administradora');
  return sesion;
}

// Inscribe a la usuaria en un curso y completa todas sus lecciones
async function terminarCurso(sesion, cursoId) {
  await sesion.post(`/api/cursos/${cursoId}/inscribirse`, { pago_simulado: true });
  const curso = await sesion.get(`/api/cursos/${cursoId}`);
  let ultima;
  for (const leccion of curso.datos.lecciones) {
    ultima = await sesion.post(`/api/lecciones/${leccion.id}/completar`);
  }
  return ultima;
}

module.exports = {
  Sesion, nuevaUsuaria, registrarSinVerificar, sesionAdmin, emailUnico,
  terminarCurso, ultimoCorreo, tokenDelCorreo, fichaDePrueba
};
