// =====================================================================
// CATÁLOGO DE CURSOS: botones de categoría + tarjetas + «Próximamente».
// Lo usan cursos.html y el Inicio (index.html), así se ven igual en los dos.
// Necesita api() y esc() de /js/api.js.
// =====================================================================

function precioTexto(precio) {
  const n = Number(precio);
  return n === 0 ? 'Gratis' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

// Línea de datos: «4 lecciones · Certificado» y, solo si hay reseñas, «★ 4,8 (12)»
function lineaDatos(c) {
  const partes = [`${c.num_lecciones} ${c.num_lecciones === 1 ? 'lección' : 'lecciones'}`, 'Certificado'];
  if (c.num_resenas) partes.push(`<span class="catalogo-estrella">★</span> ${Number(c.media).toLocaleString('es-ES')} (${c.num_resenas})`);
  return partes.join('<span class="catalogo-punto">·</span>');
}

function tarjetaCurso(c) {
  return `
    <a class="catalogo-carta" href="/curso.html?id=${c.id}">
      <span class="catalogo-foto">
        ${c.imagen ? htmlPortada(c) : '<span class="catalogo-sin-foto" aria-hidden="true">GLAMIO</span>'}
      </span>
      <span class="catalogo-cuerpo">
        <span class="catalogo-categoria">${esc(c.categoria)}</span>
        <strong class="catalogo-nombre">${esc(c.titulo)}</strong>
        <span class="catalogo-datos">${lineaDatos(c)}</span>
        <span class="catalogo-pie">
          <span class="catalogo-ver">Ver curso <span aria-hidden="true">→</span></span>
          <span class="catalogo-precio${Number(c.precio) === 0 ? ' gratis' : ''}">${precioTexto(c.precio)}</span>
        </span>
      </span>
    </a>`;
}

// Pinta el catálogo completo en dos cajas: la de los botones y la de las tarjetas.
// Los cursos se piden UNA vez; al cambiar de categoría se filtran aquí, sin volver al servidor.
async function pintarCatalogo(cajaBotones, cajaLista) {
  let cursos, categorias;
  try {
    [cursos, categorias] = await Promise.all([api('/api/cursos'), api('/api/categorias')]);
  } catch (err) {
    cajaLista.innerHTML = `<p class="mensaje error">No se pudieron cargar los cursos: ${esc(err.message)}</p>`;
    return;
  }

  function mostrar(categoriaId) {
    const lista = categoriaId ? cursos.filter(c => String(c.categoria_id) === categoriaId) : cursos;
    // Categoría todavía sin cursos: un aviso de «Próximamente» en vez de una página vacía
    const cat = categorias.find(c => String(c.id) === categoriaId);
    cajaLista.innerHTML = lista.map(tarjetaCurso).join('') || `
      <div class="catalogo-vacio">
        <p class="catalogo-antetitulo">Próximamente</p>
        <p class="catalogo-vacio-titulo">Cursos de ${esc(cat ? cat.nombre : 'esta categoría')}</p>
        <p class="catalogo-sub">Estamos preparando nuevas formaciones. Mientras tanto, descubre el resto de cursos de la Academia.</p>
        <button type="button" class="boton secundario" data-ver-todos>Ver todos los cursos</button>
      </div>`;
    cajaBotones.querySelectorAll('button').forEach(b => {
      const activa = b.dataset.id === categoriaId;
      b.classList.toggle('activa', activa);
      b.setAttribute('aria-selected', activa);
    });
  }

  // Todas las categorías, también las que aún no tienen cursos (salen con 0 y «Próximamente»)
  const cuenta = id => cursos.filter(c => c.categoria_id === id).length;
  const boton = (id, nombre, n) =>
    `<button type="button" role="tab" data-id="${id}">${esc(nombre)}<span class="catalogo-cuenta">${n}</span></button>`;
  cajaBotones.innerHTML = boton('', 'Todos', cursos.length) +
    categorias.map(cat => boton(cat.id, cat.nombre, cuenta(cat.id))).join('');
  cajaBotones.onclick = (e) => { const b = e.target.closest('button'); if (b) mostrar(b.dataset.id); };
  cajaLista.onclick = (e) => { if (e.target.closest('[data-ver-todos]')) mostrar(''); };
  mostrar('');
}
