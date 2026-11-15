// Funciones comunes para todas las páginas

// Llama a la API y devuelve JSON (lanza error si falla)
async function api(url, opciones = {}) {
  // Si no es FormData, enviamos JSON
  if (opciones.body && !(opciones.body instanceof FormData)) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(opciones.body);
  }
  const res = await fetch(url, opciones);
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error || 'Algo salió mal');
  return datos;
}

// Lee un parámetro de la URL: ?id=3 → param('id') = '3'
function param(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

// Página a la que va cada perfil al entrar
// Fase 1: para la clienta, GLAMIO es solo el muro de trabajos (en solo lectura).
function paginaInicio(usuaria) {
  return usuaria && usuaria.perfil === 'clienta' ? '/muro.html' : '/index.html';
}

// Pinta la cabecera según la sesión
async function pintarCabecera() {
  const usuaria = await api('/api/auth/yo');

  // La clienta solo puede estar en el muro: si abre otra página, la llevamos allí.
  // (Es para que la app se vea bien; la seguridad de verdad está en el servidor.)
  if (usuaria && usuaria.perfil === 'clienta' && !location.pathname.endsWith('/muro.html')) {
    location.replace('/muro.html');
    return usuaria;
  }

  const menu = document.querySelector('.menu');
  if (!menu) return usuaria;

  if (usuaria && usuaria.perfil === 'clienta') {
    menu.innerHTML = `<a href="/muro.html">Muro</a><a href="#" id="salir">Salir (${esc(usuaria.nombre)})</a>`;
    activarSalir();
    return usuaria;
  }

  let html = `<a href="/index.html">Cursos</a><a href="/muro.html">Muro</a>`;
  if (usuaria) {
    html += `<a href="/calculadora.html">Calcular mi precio</a>`;
    // Solo quien hace cursos tiene certificados
    if (['alumna', 'profesional'].includes(usuaria.perfil)) html += `<a href="/certificados.html">Mis certificados</a>`;
    if (usuaria.perfil === 'administradora') html += `<a href="/admin.html">Panel</a>`;
    html += `<a href="#" id="salir">Salir (${esc(usuaria.nombre)})</a>`;
  } else {
    html += `<a href="/login.html">Entrar</a><a href="/registro.html">Registrarme</a>`;
  }
  menu.innerHTML = html;
  activarSalir();
  return usuaria;
}

// Botón "Salir": cierra la sesión y vuelve al inicio
function activarSalir() {
  const salir = document.getElementById('salir');
  if (salir) salir.onclick = async (e) => {
    e.preventDefault();
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/index.html';
  };
}

// Pinta los chips de categorías y llama a alCambiar(id) al pulsar
async function pintarFiltros(contenedor, alCambiar) {
  const categorias = await api('/api/categorias');
  contenedor.innerHTML = `<button class="chip activo" data-id="">Todas</button>` +
    categorias.map(c => `<button class="chip" data-id="${c.id}">${c.icono || ''} ${c.nombre}</button>`).join('');
  contenedor.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      contenedor.querySelectorAll('.chip').forEach(c => c.classList.remove('activo'));
      chip.classList.add('activo');
      alCambiar(chip.dataset.id);
    };
  });
  return categorias;
}

// Evita inyectar HTML con textos de usuarias
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}
