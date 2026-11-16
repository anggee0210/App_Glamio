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

// 👁 Mostrar / ocultar la contraseña (pantallas Entrar y Registrarme)
function activarVerContrasena() {
  document.querySelectorAll('.ver-contrasena').forEach(boton => {
    boton.onclick = () => {
      const campo = boton.parentElement.querySelector('input');
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      boton.setAttribute('aria-label', mostrar ? 'Ocultar la contraseña' : 'Mostrar la contraseña');
      boton.title = boton.getAttribute('aria-label');
      boton.classList.toggle('activo', mostrar);
    };
  });
}

// Logo de la cabecera: sello redondo con la G dorada + "GLAMIO / ACADEMIA DE BELLEZA".
// Se pinta aquí para no repetirlo en cada página HTML. También pone el icono de la pestaña.
function pintarLogo(cabecera) {
  const logo = cabecera.querySelector('.logo');
  if (logo && !logo.querySelector('img')) {
    logo.innerHTML = `<img src="/img/logo-g.png" alt="">
      <span class="logo-texto"><span class="logo-nombre">GLAMIO</span><span class="logo-lema">ACADEMIA DE BELLEZA</span></span>`;
    logo.setAttribute('aria-label', 'GLAMIO, ir al inicio');
  }
  if (!document.querySelector('link[rel=icon]')) {
    document.head.insertAdjacentHTML('beforeend', '<link rel="icon" href="/img/favicon.png">');
  }
}

// ¿En qué sección estamos? Sirve para resaltar en lila la opción del menú.
function seccionActual() {
  const p = location.pathname;
  if (/\/(cursos?|leccion|certificados?)\.html$/.test(p)) return 'cursos';
  if (p.endsWith('/muro.html')) return 'comunidad';
  if (p.endsWith('/calculadora.html')) return 'calculadora';
  if (p.endsWith('/avisos.html')) return 'avisos';
  if (p.endsWith('/admin.html')) return 'panel';
  if (p.endsWith('/reportes.html')) return 'reportes';
  return 'inicio';
}
const NOMBRES_PERFIL = { administradora: 'Administradora', alumna: 'Alumna', profesional: 'Profesional', clienta: 'Clienta' };
const ICONO_CAMPANA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;

// Lo de la derecha de la cabecera: 🔔 (con su número) y el círculo de perfil con su menú
function htmlDerecha(usuaria) {
  if (!usuaria) {
    return `<span class="menu-derecha"><a href="/registro.html">Registrarme</a><a href="/login.html" class="boton-entrar">Entrar</a></span>`;
  }
  // (La 🔔 suelta ya no está: «Avisos» y la campana eran lo mismo. Ahora hay una sola opción, «Notificaciones», en el menú.)
  const certificados = ['alumna', 'profesional'].includes(usuaria.perfil)
    ? '<a href="/certificados.html">🎓 Mis certificados</a>' : '';
  return `<span class="menu-derecha">
    <span class="perfil" id="perfil">
      <button type="button" class="boton-perfil" aria-haspopup="true" aria-expanded="false">
        <span class="inicial">${esc(usuaria.nombre.trim().charAt(0).toUpperCase())}</span>
        <span class="nombre-perfil">${esc(usuaria.nombre)}<small>${NOMBRES_PERFIL[usuaria.perfil] || ''}</small></span> ▾
      </button>
      <span class="menu-perfil">${certificados}<a href="#" id="salir">Salir (${esc(usuaria.nombre)})</a></span>
    </span></span>`;
}

// El menú del perfil se abre al pulsar el círculo y se cierra al pulsar fuera
function activarPerfil() {
  const perfil = document.getElementById('perfil');
  if (!perfil) return;
  const boton = perfil.querySelector('.boton-perfil');
  boton.onclick = (e) => {
    e.stopPropagation();
    boton.setAttribute('aria-expanded', perfil.classList.toggle('abierto'));
  };
  document.addEventListener('click', () => { perfil.classList.remove('abierto'); boton.setAttribute('aria-expanded', false); });
}

// Pie morado con el logo de neón, igual en todas las páginas (se añade una sola vez)
function pintarPie(usuaria) {
  if (document.querySelector('.pie') || !document.querySelector('.cabecera')) return;
  const esClienta = usuaria && usuaria.perfil === 'clienta';
  const enlaces = esClienta ? '<a href="/muro.html">Muro</a>'
    : `<a href="/index.html">Inicio</a><a href="/cursos.html">Cursos</a><a href="/muro.html">${usuaria ? 'Comunidad' : 'Muro'}</a>` +
      (usuaria ? '<a href="/calculadora.html">Calculadora</a>' : '<a href="/login.html">Entrar</a>');
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="pie"><div class="pie-dentro">
      <span class="pie-logo"><img src="/img/logo-glamio.jpg" alt="">
        <span class="logo-texto"><span class="logo-nombre">GLAMIO</span><span class="logo-lema">ACADEMIA DE BELLEZA</span></span></span>
      <nav class="pie-enlaces" aria-label="Enlaces del pie">${enlaces}</nav>
      <p class="pie-nota">GLAMIO · Proyecto final de clase · 2026</p>
    </div></footer>`);
}

// ---------- Menú lateral de la administradora (diseños "Panel de Gestión", "Avisos" y "Reportes") ----------
// Sale en el Panel y en Reportes (Notificaciones ya está en el menú de arriba). Las opciones del Panel abren su pestaña.
const OPCIONES_LATERAL = [
  { clave: 'resumen', href: '/admin.html', texto: '🏠 Panel principal' },
  { clave: 'cursos', href: '/admin.html?pestana=cursos', texto: '📚 Mis cursos' },
  { clave: 'curso', href: '/admin.html?pestana=curso', texto: '➕ Nuevo curso' },
  { clave: 'leccion', href: '/admin.html?pestana=leccion', texto: '🎬 Nueva lección' },
  { clave: 'material', href: '/admin.html?pestana=material', texto: '🧴 Materiales' },
  { clave: 'certificado', href: '/admin.html?pestana=certificado', texto: '🎓 Certificado' },
  { clave: 'guias', href: '/admin.html?pestana=guias', texto: '📖 Guías teóricas' },
  { clave: 'reportes', href: '/reportes.html', texto: '⚑ Reportes', extra: ' id="enlace-reportes" title="Reportes pendientes"', contador: '<span class="contador oculto"></span>' },
];

// ¿Qué opción del lateral está abierta? (en el Panel, la pestaña de la URL)
function claveLateral() {
  const p = location.pathname;
  if (p.endsWith('/reportes.html')) return 'reportes';
  return param('pestana') || 'resumen';
}

// Resalta la opción abierta (el Panel la llama también al cambiar de pestaña)
function marcarLateral() {
  const clave = claveLateral();
  document.querySelectorAll('.lateral a').forEach(a => a.classList.toggle('activa', a.dataset.clave === clave));
}

function pintarLateral() {
  const main = document.querySelector('main');
  if (!main || document.querySelector('.lateral')) return;
  const envoltorio = document.createElement('div');
  envoltorio.className = 'con-lateral';
  envoltorio.innerHTML = `<aside class="lateral" aria-label="Gestión de la academia"><nav>
    ${OPCIONES_LATERAL.map(o => `<a href="${o.href}" data-clave="${o.clave}"${o.extra || ''}>${o.texto}${o.contador || ''}</a>`).join('')}
  </nav></aside>`;
  main.before(envoltorio);
  envoltorio.appendChild(main);
  // Dentro del Panel, las opciones cambian de pestaña sin recargar la página
  if (location.pathname.endsWith('/admin.html') && typeof abrirPestanaPanel === 'function') {
    envoltorio.querySelectorAll('a[href^="/admin.html"]').forEach(a => a.onclick = (e) => {
      e.preventDefault();
      abrirPestanaPanel(a.dataset.clave);
    });
  }
  marcarLateral();
}

// Pinta la cabecera (y el pie) según la sesión
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
  pintarLogo(menu.closest('.cabecera'));
  prepararBotonMenu(menu);
  pintarPie(usuaria);

  // Opción del menú: la de la página actual sale resaltada (class="activa")
  const seccion = seccionActual();
  const opcion = (clave, href, texto, extra = '') =>
    `<a href="${href}"${seccion === clave ? ' class="activa" aria-current="page"' : ''}${extra}>${texto}</a>`;

  if (usuaria && usuaria.perfil === 'clienta') {
    menu.innerHTML = opcion('comunidad', '/muro.html', 'Muro') + htmlDerecha(usuaria);
    activarSalir();
    activarPerfil();
    return usuaria;
  }

  // Quien hace cursos ve "Comunidad" (trabajos + dudas). Sin cuenta solo se ven trabajos: "Muro".
  let html = opcion('inicio', '/index.html', 'Inicio') + opcion('cursos', '/cursos.html', 'Cursos') +
    opcion('comunidad', '/muro.html', usuaria ? 'Comunidad' : 'Muro');
  if (usuaria) {
    // Calculadora "Calcular mi precio": servicios propios y los guardados.
    // (Desde cada curso hay otro botón que abre la calculadora con sus materiales.)
    html += opcion('calculadora', '/calculadora.html', 'Calculadora');
    // Avisos 🔔: la directora, dudas y reseñas sin responder; alumna y profesional, respuestas nuevas
    html += opcion('avisos', '/avisos.html', '🔔 Notificaciones<span class="contador contador-avisos oculto"></span>', ' id="campana" title="Notificaciones"');
    if (usuaria.perfil === 'administradora') {
      // "Panel" queda arriba; Reportes y el resto de la gestión van en el menú lateral (pintarLateral)
      html += opcion('panel', '/admin.html', 'Panel');
    }
  }
  menu.innerHTML = html + htmlDerecha(usuaria);
  activarSalir();
  activarPerfil();
  // La administradora tiene además el menú lateral en sus páginas de gestión
  if (usuaria && usuaria.perfil === 'administradora' && /\/(admin|reportes)\.html$/.test(location.pathname)) pintarLateral();
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
  // El número sale en la 🔔 y en la opción «Avisos» del menú (las dos llevan .contador-avisos)
  const contadores = document.querySelectorAll('.contador-avisos');
  if (!contadores.length || !usuariaCampana) return;
  try {
    const { dudas, reportes, resenas, respuestas } = await cargarAvisos(usuariaCampana);
    // Los reportes van en su propio contador ("⚑ Reportes"), así no se cuentan dos veces
    const n = dudas.length + resenas.length + respuestas.length;
    contadores.forEach(c => ponerNumero(c, n));
    ponerNumero(document.querySelector('#enlace-reportes .contador'), reportes.length);
    // En el móvil el menú está cerrado: un puntito rojo en "☰ Menú" avisa de que hay algo
    const punto = document.querySelector('#boton-menu .punto');
    if (punto) punto.classList.toggle('oculto', n + reportes.length === 0);
    const partes = [];
    if (dudas.length) partes.push(`${dudas.length} ${dudas.length === 1 ? 'duda' : 'dudas'} sin responder`);
    if (resenas.length) partes.push(`${resenas.length} ${resenas.length === 1 ? 'reseña' : 'reseñas'} de 1-3 ⭐ sin responder`);
    if (respuestas.length) partes.push(`${respuestas.length} ${respuestas.length === 1 ? 'respuesta nueva' : 'respuestas nuevas'} a tus dudas`);
    const campana = document.getElementById('campana');
    if (campana) campana.title = partes.join(' · ') || 'No hay avisos nuevos';
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
    <p class="ayuda">Se ocultará al momento y la administradora lo revisará.</p>
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

// "hace 5 min", "hace 3 h", "ayer 18:20", "hace 4 días" o "12 nov" (lo usan varias páginas)
function haceCuanto(fecha) {
  const d = new Date(fecha);
  const minutos = Math.round((Date.now() - d) / 60000);
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 24 * 60) return `hace ${Math.round(minutos / 60)} h`;
  if (minutos < 48 * 60) return 'ayer ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (minutos < 7 * 24 * 60) return `hace ${Math.round(minutos / 1440)} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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

/* ---------- Ver una foto en grande, con una ✕ para cerrar ----------
   Los enlaces <a class="ver-foto"> abrían la foto en otra pestaña. Ahora se ve
   encima de la página (visor) y se cierra con la ✕, haciendo clic fuera o con Esc.
   El enlace sigue teniendo href: si el JavaScript fallara, se abriría como antes. */
function abrirVisorFoto(ruta, descripcion) {
  const visor = document.createElement('div');
  visor.className = 'visor-foto';
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-modal', 'true');
  visor.innerHTML = `
    <button type="button" class="visor-cerrar" aria-label="Cerrar la foto" title="Cerrar">✕</button>
    <img src="${esc(ruta)}" alt="${esc(descripcion)}">`;

  const cerrar = () => {
    visor.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', conTecla);
  };
  const conTecla = (e) => { if (e.key === 'Escape') cerrar(); };

  visor.querySelector('.visor-cerrar').onclick = cerrar;
  visor.onclick = (e) => { if (e.target === visor) cerrar(); }; // clic en el fondo oscuro, no en la foto
  document.addEventListener('keydown', conTecla);

  document.body.style.overflow = 'hidden'; // que la página de detrás no se mueva
  document.body.appendChild(visor);
  visor.querySelector('.visor-cerrar').focus();
}

// Un solo "escuchador" para toda la página: sirve también para las tarjetas que se pintan después
document.addEventListener('click', (e) => {
  const enlace = e.target.closest('a.ver-foto');
  if (!enlace) return;
  e.preventDefault(); // no abrir otra pestaña
  const img = enlace.querySelector('img');
  abrirVisorFoto(enlace.getAttribute('href'), img ? img.alt : '');
});
