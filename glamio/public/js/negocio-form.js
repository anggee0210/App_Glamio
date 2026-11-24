// «Mi negocio» de la profesional (25/11): el formulario y la tarjeta para leerlo.
// El FORMULARIO lo usan el registro (registro.html) y la página Mi negocio (mi-negocio.html).
// htmlVerNegocio() (para leer) lo usan el perfil público y el Panel → Profesionales.
// Las comprobaciones de verdad están en el servidor (routes/profesionales.js).
// Necesita esc() y api() de /js/api.js.

let CATEGORIAS_NEGOCIO = []; // Uñas, Cabello, Cejas… (se piden una sola vez)

async function cargarCategoriasNegocio() {
  if (!CATEGORIAS_NEGOCIO.length) CATEGORIAS_NEGOCIO = await api('/api/categorias');
  return CATEGORIAS_NEGOCIO;
}

// El HTML del formulario, relleno con su negocio si ya existe (n = null si es nuevo).
// Rediseño 25/11: por bloques con título (como las apps de gestión de negocios), especialidades como
// botones que se encienden, «a domicilio» como interruptor, Instagram con la @ delante y contador en «Sobre mí».
function htmlFormNegocio(n) {
  const v = (campo) => esc(n && n[campo] != null ? n[campo] : '');
  const elegidas = n ? n.especialidades : [];
  const botones = CATEGORIAS_NEGOCIO.map(c => `
    <label class="nf-pill"><input type="checkbox" name="especialidad" value="${c.id}" ${elegidas.includes(c.id) ? 'checked' : ''}>
      <span>${esc(c.nombre)}</span></label>`).join('');
  return `
    <div class="nf">
      <section class="nf-bloque">
        <h3 class="nf-titulo">Tu negocio</h3>
        <p class="nf-ayuda">El nombre de tu salón o marca. Si trabajas por tu cuenta, déjalo vacío.</p>
        <label class="nf-campo"><span>Nombre del negocio</span>
          <input name="nombre_negocio" value="${v('nombre_negocio')}" maxlength="100" autocomplete="off" placeholder="Ej: Studio Lila"></label>
      </section>

      <section class="nf-bloque">
        <h3 class="nf-titulo">Dónde trabajas</h3>
        <p class="nf-ayuda">Las clientas te buscan por ciudad o barrio. Nunca pongas tu dirección.</p>
        <div class="nf-dos">
          <label class="nf-campo"><span>Ciudad</span>
            <input name="ciudad" value="${v('ciudad')}" maxlength="80" autocomplete="off" required placeholder="Ej: Madrid"></label>
          <label class="nf-campo"><span>Barrio o zona <small>(opcional)</small></span>
            <input name="zona" value="${v('zona')}" maxlength="80" autocomplete="off" placeholder="Ej: Chamberí"></label>
        </div>
        <label class="interruptor nf-interruptor"><input type="checkbox" name="a_domicilio" ${n && n.a_domicilio ? 'checked' : ''}>
          <span class="interruptor-pista" aria-hidden="true"></span><span>También atiendo a domicilio</span></label>
      </section>

      <section class="nf-bloque">
        <h3 class="nf-titulo">Especialidades</h3>
        <p class="nf-ayuda">Elige al menos una. Con ellas te encuentran en el directorio.</p>
        <div class="nf-pills" role="group" aria-label="Especialidades">${botones}</div>
      </section>

      <section class="nf-bloque">
        <h3 class="nf-titulo">Experiencia y redes</h3>
        <div class="nf-dos">
          <label class="nf-campo"><span>Años de experiencia <small>(opcional)</small></span>
            <input type="number" name="anios_experiencia" value="${v('anios_experiencia')}" min="0" max="60" step="1" inputmode="numeric" placeholder="Ej: 3"></label>
          <label class="nf-campo"><span>Instagram <small>(opcional)</small></span>
            <span class="nf-prefijo"><span aria-hidden="true">@</span>
              <input name="instagram" value="${v('instagram')}" maxlength="60" autocomplete="off" placeholder="tu.usuario" aria-label="Usuario de Instagram"></span></label>
        </div>
      </section>

      <section class="nf-bloque">
        <h3 class="nf-titulo">Sobre mí</h3>
        <p class="nf-ayuda">Una presentación corta: lo que haces, cómo trabajas, qué productos usas.</p>
        <label class="nf-campo"><span class="visualmente-oculto">Sobre mí</span>
          <textarea name="sobre_mi" maxlength="400" rows="4" placeholder="Ej: Especialista en uñas acrílicas y nail art. Trabajo con productos veganos.">${v('sobre_mi')}</textarea>
          <small class="nf-contador"><span class="nf-cuenta">0</span> / 400</small></label>
      </section>
    </div>`;
}

// Contador de «Sobre mí» y, si se pasa alCambiar, aviso en cada cambio (la vista previa de mi-negocio.html)
function activarFormNegocio(caja, alCambiar) {
  const texto = caja.querySelector('[name=sobre_mi]');
  const cuenta = caja.querySelector('.nf-cuenta');
  const contar = () => { cuenta.textContent = texto.value.length; };
  texto.addEventListener('input', contar);
  contar();
  if (alCambiar) {
    caja.addEventListener('input', alCambiar);
    caja.addEventListener('change', alCambiar);
  }
}
// Lee el formulario (que puede estar dentro de otro más grande, como el del registro)
function leerFormNegocio(caja) {
  const valor = (nombre) => { const el = caja.querySelector(`[name=${nombre}]`); return el ? el.value : ''; };
  return {
    nombre_negocio: valor('nombre_negocio'),
    ciudad: valor('ciudad'),
    zona: valor('zona'),
    especialidades: [...caja.querySelectorAll('[name=especialidad]:checked')].map(c => Number(c.value)),
    anios_experiencia: valor('anios_experiencia'),
    a_domicilio: caja.querySelector('[name=a_domicilio]').checked,
    instagram: valor('instagram'),
    sobre_mi: valor('sobre_mi')
  };
}

// La tarjeta del negocio PARA LEER (perfil público y Panel). n = lo que devuelve el servidor.
function htmlVerNegocio(n) {
  const lugar = [n.zona, n.ciudad].filter(Boolean).map(esc).join(', ');
  const especialidades = (n.especialidades_nombres || []).map(c => `<span class="negocio-chip">${esc(c.nombre)}</span>`).join('');
  const datos = [
    n.anios_experiencia != null ? `${n.anios_experiencia} ${n.anios_experiencia === 1 ? 'año' : 'años'} de experiencia` : '',
    n.a_domicilio ? 'Atiende a domicilio' : ''
  ].filter(Boolean).join(' · ');
  return `<div class="negocio-tarjeta">
    ${n.nombre_negocio ? `<p class="negocio-nombre">${esc(n.nombre_negocio)}</p>` : ''}
    <p class="negocio-lugar">${lugar}</p>
    <p class="negocio-chips">${especialidades}</p>
    ${datos ? `<p class="negocio-datos">${datos}</p>` : ''}
    ${n.sobre_mi ? `<p class="negocio-sobre">${esc(n.sobre_mi)}</p>` : ''}
    ${n.instagram ? `<p><a class="negocio-instagram" href="https://instagram.com/${encodeURIComponent(n.instagram)}" target="_blank" rel="noopener">@${esc(n.instagram)}</a></p>` : ''}
  </div>`;
}
