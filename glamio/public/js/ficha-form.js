// Formulario de la ficha personal de la alumna (18/11).
// El FORMULARIO solo lo usa la administradora (alumnas.html): ella es la única que crea y modifica fichas.
// htmlVerFicha() (para leer) lo usan las dos páginas: "Alumnas" y "Mis datos" (cuenta.html, la alumna).
// Las comprobaciones de verdad están en el servidor (routes/ficha.js); aquí solo se ayuda a escribirlo bien.

let PAISES_FICHA = []; // se piden una sola vez

async function cargarPaises() {
  if (!PAISES_FICHA.length) PAISES_FICHA = await api('/api/ficha/paises');
  return PAISES_FICHA;
}

// Fecha máxima del calendario: hace 14 años (la edad mínima)
function fechaMaximaFicha() {
  const f = new Date();
  f.setFullYear(f.getFullYear() - 14);
  const dos = x => String(x).padStart(2, '0');
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
}

// El HTML del formulario, relleno con la ficha si ya existe (f = null si es nueva)
function htmlFormFicha(f) {
  const v = (campo) => esc(f ? f[campo] : '');
  const opciones = PAISES_FICHA.map(p =>
    `<option value="${p.codigo}" ${f && f.pais_nacimiento === p.codigo ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
  return `
    <div class="ficha-rejilla">
      <label class="ficha-ancho">Nombre completo (nombre y apellidos)
        <input name="nombre_completo" value="${v('nombre_completo')}" maxlength="150" autocomplete="off" required>
      </label>
      <label>País de nacimiento
        <select name="pais_nacimiento" required>
          <option value="" ${f ? '' : 'selected'} disabled>Elige un país…</option>${opciones}
        </select>
      </label>
      <label>Ciudad de nacimiento
        <input name="ciudad_nacimiento" value="${v('ciudad_nacimiento')}" maxlength="100" autocomplete="off" required>
      </label>
      <fieldset class="ficha-ancho ficha-nie oculto">
        <legend>¿Qué documento presenta?</legend>
        <label class="ficha-radio"><input type="radio" name="tipo_doc" value="pais" ${f && f.usa_nie ? '' : 'checked'}>
          <span class="doc-pais">El de su país</span></label>
        <label class="ficha-radio"><input type="radio" name="tipo_doc" value="nie" ${f && f.usa_nie ? 'checked' : ''}>
          <span>NIE (documento de extranjera en España)</span></label>
      </fieldset>
      <label><span class="doc-etiqueta">Documento de identidad</span>
        <input name="numero_documento" value="${v('numero_documento')}" maxlength="25" autocomplete="off" required>
        <small class="ayuda doc-ejemplo">Primero elige el país</small>
      </label>
      <label>Fecha de nacimiento
        <input type="date" name="fecha_nacimiento" value="${v('fecha_nacimiento')}" min="1900-01-01" max="${fechaMaximaFicha()}" required>
      </label>
      <label class="ficha-ancho">Dirección (calle, número, piso, ciudad y código postal)
        <input name="direccion" value="${v('direccion')}" maxlength="200" autocomplete="off" required>
      </label>
      <label>Teléfono
        <input type="tel" name="telefono" value="${v('telefono')}" maxlength="20" placeholder="+34 600 111 222" autocomplete="off" required>
      </label>
    </div>`;
}

// Cuando cambia el país, cambia el nombre del documento y su ejemplo.
// La opción del NIE solo sale si el país NO es España.
function activarFormFicha(form) {
  const select = form.querySelector('[name=pais_nacimiento]');
  const radios = form.querySelectorAll('[name=tipo_doc]');
  const actualizar = () => {
    const pais = PAISES_FICHA.find(p => p.codigo === select.value);
    const cajaNie = form.querySelector('.ficha-nie');
    const etiqueta = form.querySelector('.doc-etiqueta');
    const ejemplo = form.querySelector('.doc-ejemplo');
    if (!pais) return;
    const fuera = pais.codigo !== 'ES';
    cajaNie.classList.toggle('oculto', !fuera);
    if (!fuera) form.querySelector('[name=tipo_doc][value=pais]').checked = true;
    form.querySelector('.doc-pais').textContent = `${pais.documento} de ${pais.nombre}`;
    const nie = fuera && form.querySelector('[name=tipo_doc][value=nie]').checked;
    etiqueta.textContent = nie ? 'NIE' : pais.documento;
    ejemplo.textContent = 'Ejemplo: ' + (nie ? 'X1234567L' : pais.ejemplo);
  };
  select.addEventListener('change', actualizar);
  radios.forEach(r => r.addEventListener('change', actualizar));
  actualizar();
}

// Lee el formulario y lo deja como lo espera el servidor (PUT /api/ficha)
function leerFormFicha(form) {
  const datos = Object.fromEntries(new FormData(form));
  datos.usa_nie = datos.tipo_doc === 'nie' && datos.pais_nacimiento !== 'ES';
  delete datos.tipo_doc;
  return datos;
}

// La ficha para LEER (sin formulario): una lista de "dato: valor"
function htmlVerFicha(f) {
  const fila = (nombre, valor) => `<div><dt>${nombre}</dt><dd>${esc(valor)}</dd></div>`;
  const [a, m, d] = f.fecha_nacimiento.split('-');
  return `<dl class="ficha-datos">
    ${fila('Nombre completo', f.nombre_completo)}
    ${fila('Lugar de nacimiento', `${f.ciudad_nacimiento} (${f.pais})`)}
    ${fila(f.documento, f.numero_documento)}
    ${fila('Fecha de nacimiento', `${d}/${m}/${a}`)}
    ${fila('Dirección', f.direccion)}
    ${fila('Teléfono', f.telefono)}
  </dl>`;
}
