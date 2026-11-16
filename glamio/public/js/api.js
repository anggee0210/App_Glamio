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

// ☰ Menú para el móvil. En pantallas pequeñas el menú se esconde y este botón lo abre y cierra
// (el CSS decide cuándo se ve: en el ordenador el botón no aparece y el menú sale como siempre).
function prepararBotonMenu(menu) {
  const cabecera = menu.closest('.cabecera');
  if (!cabecera || document.getElementById('boton-menu')) return;
  const boton = document.createElement('button');
  boton.id = 'boton-menu';
  boton.className = 'boton-menu';
  boton.type = 'button';
  boton.setAttribute('aria-expanded', 'false'); // para lectores de pantalla: ¿está abierto?
  boton.innerHTML = '<span class="texto-boton-menu">☰ Menú</span><span class="punto oculto" title="Tienes avisos"></span>';
  boton.onclick = () => {
    const abierta = cabecera.classList.toggle('abierta');
    boton.setAttribute('aria-expanded', abierta);
    boton.querySelector('.texto-boton-menu').textContent = abierta ? '✕ Cerrar' : '☰ Menú';
  };
  // Al elegir una opción, el menú se cierra solo
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a') && cabecera.classList.contains('abierta')) boton.click();
  });
  menu.before(boton);
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
  prepararBotonMenu(menu);

  if (usuaria && usuaria.perfil === 'clienta') {
    menu.innerHTML = `<a href="/muro.html">Muro</a><a href="#" id="salir">Salir (${esc(usuaria.nombre)})</a>`;
    activarSalir();
    return usuaria;
  }

  // Quien hace cursos ve "Comunidad" (trabajos + dudas). Sin cuenta solo se ven trabajos: "Muro".
  // (La página sigue siendo muro.html: la clienta ya tiene su propio menú, arriba.)
  let html = `<a href="/index.html">Cursos</a><a href="/muro.html">${usuaria ? 'Comunidad' : 'Muro'}</a>`;
  if (usuaria) {
    // "Mis precios": servicios propios y la lista de los guardados.
    // (Desde cada curso hay otro botón que abre la calculadora con sus materiales.)
    html += `<a href="/calculadora.html">Mis precios</a>`;
    // Solo quien hace cursos tiene certificados
    if (['alumna', 'profesional'].includes(usuaria.perfil)) html += `<a href="/certificados.html">Mis certificados</a>`;
    if (usuaria.perfil === 'administradora') {
      html += `<a href="/admin.html">Panel</a>`;
      // Moderación en su propia página, con su número rojo (no se suma a la 🔔)
      html += `<a href="/reportes.html" id="enlace-reportes" title="Reportes pendientes">⚑ Reportes<span class="contador oculto"></span></a>`;
    }
    // 🔔 La directora: dudas sin responder. Alumna y profesional: respuestas nuevas a sus dudas.
    // La alumna y la profesional ven además la palabra "Notificaciones", más clara que la campana sola
    const textoCampana = usuaria.perfil === 'administradora' ? '' : ' Notificaciones';
    html += `<a href="/avisos.html" id="campana" title="Notificaciones">🔔${textoCampana}<span class="contador oculto"></span></a>`;
    html += `<a href="#" id="salir">Salir (${esc(usuaria.nombre)})</a>`;
  } else {
    html += `<a href="/login.html">Entrar</a><a href="/registro.html">Registrarme</a>`;
  }
  menu.innerHTML = html;
  activarSalir();
  if (usuaria) {
    usuariaCampana = usuaria;
    actualizarCampana();
    // Cada minuto vuelve a preguntar al servidor, por si llega algo con la página abierta
    // (sin servicios externos: solo un fetch).
    setInterval(actualizarCampana, 60 * 1000);
  }
  return usuaria;
}

// 🔔 Avisos de cada perfil. La directora: dudas sin responder + reportes pendientes
// + reseñas de 1 a 3 ⭐ sin responder. Alumna y profesional: respuestas nuevas a sus dudas.
// Devuelve { dudas, reportes, resenas, respuestas }.
let usuariaCampana = null;
async function cargarAvisos(usuaria) {
  if (usuaria.perfil === 'administradora') {
    // Las tres peticiones a la vez (Promise.all): tarda lo que la más lenta, no la suma
    const [dudas, reportes, resenas] = await Promise.all([
      api('/api/dudas/sin-responder'), api('/api/reportes'), api('/api/resenas/sin-responder')]);
    return { dudas, reportes, resenas, respuestas: [] };
  }
  return { dudas: [], reportes: [], resenas: [], respuestas: await api('/api/dudas/mis-avisos') };
}

// Número rojo de un enlace del menú (se oculta si es 0)
function ponerNumero(contador, n) {
  if (!contador) return;
  contador.textContent = n > 99 ? '99+' : n;
  contador.classList.toggle('oculto', n === 0);
}

// Pone en la campana el número de avisos (sin número si no hay ninguno)
async function actualizarCampana() {
  const contador = document.querySelector('#campana .contador');
  if (!contador || !usuariaCampana) return;
  try {
    const { dudas, reportes, resenas, respuestas } = await cargarAvisos(usuariaCampana);
    // Los reportes van en su propio contador ("⚑ Reportes"), así no se cuentan dos veces
    const n = dudas.length + resenas.length + respuestas.length;
    ponerNumero(contador, n);
    ponerNumero(document.querySelector('#enlace-reportes .contador'), reportes.length);
    // En el móvil el menú está cerrado: un puntito rojo en "☰ Menú" avisa de que hay algo
    const punto = document.querySelector('#boton-menu .punto');
    if (punto) punto.classList.toggle('oculto', n + reportes.length === 0);
    const partes = [];
    if (dudas.length) partes.push(`${dudas.length} ${dudas.length === 1 ? 'duda' : 'dudas'} sin responder`);
    if (resenas.length) partes.push(`${resenas.length} ${resenas.length === 1 ? 'reseña' : 'reseñas'} de 1-3 ⭐ sin responder`);
    if (respuestas.length) partes.push(`${respuestas.length} ${respuestas.length === 1 ? 'respuesta nueva' : 'respuestas nuevas'} a tus dudas`);
    document.getElementById('campana').title = partes.join(' · ') || 'No hay avisos nuevos';
  } catch (e) {
    // Si falla (p. ej. la sesión ha caducado), la campana se queda sin número: no es grave
  }
}

// ---------- Reportar (lo usan el muro y las lecciones) ----------
// La misma lista que acepta el servidor (routes/reportes.js)
const MOTIVOS_REPORTE = ['No es un trabajo propio', 'Contenido ofensivo', 'Publicidad o spam', 'Otro'];

// Abre, justo debajo del botón "Reportar", un formulario pequeño para elegir el motivo
// (en vez de la ventanita prompt() del navegador). Si ya estaba abierto, lo cierra.
// alTerminar(mensaje) se llama cuando el servidor confirma el reporte.
function abrirReporte(boton, tipo, elementoId, alTerminar) {
  // Si el botón está en una fila de botones, la caja va DEBAJO de la fila (no apretada dentro)
  const ancla = boton.closest('.fila') || boton;
  const abierta = ancla.nextElementSibling;
  if (abierta && abierta.classList.contains('caja-reporte')) return abierta.remove();

  const caja = document.createElement('form');
  caja.className = 'caja-reporte';
  caja.innerHTML = `
    <p style="margin:0 0 6px"><strong>¿Por qué lo reportas?</strong></p>
    ${MOTIVOS_REPORTE.map((m, i) => `
      <label class="opcion-radio"><input type="radio" name="motivo" value="${m}" ${i === 0 ? 'checked' : ''}> ${m}</label>`).join('')}
    <input name="detalle" class="oculto" maxlength="300" placeholder="Cuéntanos brevemente el motivo">
    <p class="ayuda">Se ocultará al momento y la directora académica lo revisará.</p>
    <p class="mensaje error oculto"></p>
    <div class="fila" style="margin-top:6px">
      <button class="boton">Enviar reporte</button>
      <button type="button" class="chip">Cancelar</button>
    </div>`;

  const detalle = caja.querySelector('[name=detalle]');
  // "Otro" necesita una explicación: el cuadro de texto solo aparece entonces
  caja.querySelectorAll('[name=motivo]').forEach(r => r.onchange = () => {
    detalle.classList.toggle('oculto', caja.motivo.value !== 'Otro');
    if (caja.motivo.value === 'Otro') detalle.focus();
  });
  caja.querySelector('button.chip').onclick = () => caja.remove();

  caja.onsubmit = async (e) => {
    e.preventDefault();
    const enviar = caja.querySelector('button.boton');
    const error = caja.querySelector('.mensaje');
    enviar.disabled = true; // evita reportar dos veces con doble clic
    try {
      const r = await api('/api/reportes', { method: 'POST',
        body: { tipo, elemento_id: elementoId, motivo: caja.motivo.value, detalle: detalle.value } });
      caja.remove();
      alTerminar(r.mensaje);
    } catch (err) {
      error.textContent = err.message; // ej. "Cuéntanos brevemente el motivo"
      error.classList.remove('oculto');
      enviar.disabled = false;
    }
  };
  ancla.after(caja);
}

// "15 nov, 22:44" (lo usan varias páginas)
function fechaCorta(fecha) {
  return new Date(fecha).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
    categorias.map(c => `<button class="chip" data-id="${c.id}">${esc(c.icono || '')} ${esc(c.nombre)}</button>`).join('');
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
