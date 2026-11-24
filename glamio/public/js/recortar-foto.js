// Recortar la foto antes de publicarla (24/11) — sin librerías, con <canvas>.
// La alumna elige la foto y aparece un marco con la MISMA forma que la casilla del muro (4:5).
// Puede arrastrar la foto, hacer zoom o elegir "Foto completa" (se sube tal cual).
// Lo que se sube al servidor ya es la foto recortada (un JPG de 1080 × 1350 px).
//
// Uso:  const recorte = crearRecortador(inputFoto, cajaEditor);
//       const archivo = await recorte.archivoFinal();   // el recorte, o la foto original
//       recorte.limpiar();                              // después de publicar

const RECORTE_ANCHO = 1080;   // tamaño del JPG final (formato 4:5, como Instagram)
const RECORTE_ALTO = 1350;
const PROPORCION = RECORTE_ANCHO / RECORTE_ALTO;

function crearRecortador(input, caja) {
  let imagen = null;      // la foto cargada (Image)
  let urlTemporal = null; // URL.createObjectURL de la foto, para soltarla al acabar
  let modo = 'recortar';  // 'recortar' | 'completa'
  // Dónde está el centro del marco sobre la foto (0..1) y el zoom (1 = la foto justo cubre el marco)
  let centroX = 0.5, centroY = 0.5, zoom = 1;

  // Parte de la foto que se ve en el marco, en píxeles de la foto: ancho y alto
  function ventana() {
    const ancho = Math.min(imagen.naturalWidth, imagen.naturalHeight * PROPORCION) / zoom;
    return { ancho, alto: ancho / PROPORCION };
  }

  // Que el marco nunca se salga de la foto (si no, saldrían bordes vacíos)
  function ajustarCentro() {
    const v = ventana();
    const mitadX = v.ancho / 2 / imagen.naturalWidth;
    const mitadY = v.alto / 2 / imagen.naturalHeight;
    centroX = Math.min(Math.max(centroX, mitadX), 1 - mitadX);
    centroY = Math.min(Math.max(centroY, mitadY), 1 - mitadY);
  }

  // Coloca la foto dentro del marco según el centro y el zoom
  function pintar() {
    const marco = caja.querySelector('.recorte-marco');
    const foto = marco.querySelector('img');
    const v = ventana();
    const escala = marco.clientWidth / v.ancho; // píxeles de pantalla por píxel de la foto
    foto.style.width = imagen.naturalWidth * escala + 'px';
    foto.style.height = imagen.naturalHeight * escala + 'px';
    foto.style.left = (marco.clientWidth / 2 - centroX * imagen.naturalWidth * escala) + 'px';
    foto.style.top = (marco.clientHeight / 2 - centroY * imagen.naturalHeight * escala) + 'px';
  }

  function cambiarModo(nuevo) {
    modo = nuevo;
    caja.querySelectorAll('[data-modo]').forEach(b => b.classList.toggle('activo', b.dataset.modo === modo));
    caja.querySelector('.recorte-editor').classList.toggle('modo-completa', modo === 'completa');
    caja.querySelector('.recorte-nota').textContent = modo === 'recortar'
      ? 'Arrastra la foto para colocarla y usa el zoom. Lo que ves en el marco es lo que se publica.'
      : 'Se publica la foto entera, sin recortar.';
    if (modo === 'recortar') pintar();
  }

  function mostrarEditor() {
    caja.innerHTML = `
      <div class="recorte-editor">
        <div class="recorte-modos" role="group" aria-label="Cómo publicar la foto">
          <button type="button" class="chip activo" data-modo="recortar">✂ Recortar</button>
          <button type="button" class="chip" data-modo="completa">Foto completa</button>
        </div>
        <div class="recorte-zona">
          <div class="recorte-marco" title="Arrastra para colocar la foto"><img alt="Vista previa del recorte" draggable="false"></div>
          <img class="recorte-completa" alt="Vista previa de la foto completa">
        </div>
        <div class="recorte-controles">
          <label>Zoom <input type="range" class="recorte-zoom" min="1" max="3" step="0.01" value="1"></label>
          <button type="button" class="enlace-centrar">Centrar</button>
        </div>
        <p class="ayuda recorte-nota"></p>
      </div>`;
    caja.classList.remove('oculto');
    caja.querySelector('.recorte-marco img').src = urlTemporal;
    caja.querySelector('.recorte-completa').src = urlTemporal;

    caja.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => cambiarModo(b.dataset.modo));
    const deslizador = caja.querySelector('.recorte-zoom');
    deslizador.oninput = () => { zoom = Number(deslizador.value); ajustarCentro(); pintar(); };
    caja.querySelector('.enlace-centrar').onclick = () => {
      centroX = centroY = 0.5; zoom = 1; deslizador.value = 1; pintar();
    };
    activarArrastre(caja.querySelector('.recorte-marco'));
    cambiarModo('recortar');
  }

  // Arrastrar con el ratón o con el dedo (pointer events valen para los dos)
  function activarArrastre(marco) {
    let antes = null;
    marco.addEventListener('pointerdown', (e) => {
      antes = { x: e.clientX, y: e.clientY };
      try { marco.setPointerCapture(e.pointerId); } catch { /* si no se puede, se arrastra igual */ }
      marco.classList.add('arrastrando');
    });
    marco.addEventListener('pointermove', (e) => {
      if (!antes) return;
      const escala = marco.clientWidth / ventana().ancho;
      // Mover la foto a la derecha = el centro del marco va hacia la izquierda de la foto
      centroX -= (e.clientX - antes.x) / escala / imagen.naturalWidth;
      centroY -= (e.clientY - antes.y) / escala / imagen.naturalHeight;
      antes = { x: e.clientX, y: e.clientY };
      ajustarCentro();
      pintar();
    });
    const soltar = () => { antes = null; marco.classList.remove('arrastrando'); };
    marco.addEventListener('pointerup', soltar);
    marco.addEventListener('pointercancel', soltar);
  }

  function limpiar() {
    if (urlTemporal) URL.revokeObjectURL(urlTemporal);
    imagen = urlTemporal = null;
    caja.innerHTML = '';
    caja.classList.add('oculto');
  }

  // Al elegir una foto: se carga y sale el editor
  input.addEventListener('change', () => {
    limpiar();
    const archivo = input.files[0];
    if (!archivo || !archivo.type.startsWith('image/')) return;
    urlTemporal = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      imagen = img;
      centroX = centroY = 0.5; zoom = 1;
      mostrarEditor();
    };
    // Si el navegador no sabe abrirla (p. ej. HEIC del iPhone), se sube tal cual
    img.onerror = () => {
      caja.innerHTML = '<p class="ayuda">No se puede mostrar esta foto para recortarla; se publicará tal cual.</p>';
      caja.classList.remove('oculto');
      imagen = null;
    };
    img.src = urlTemporal;
  });

  // Si el marco cambia de tamaño (girar el móvil, ventana), se vuelve a colocar la foto
  window.addEventListener('resize', () => { if (imagen && modo === 'recortar') pintar(); });

  // El archivo que se sube: el recorte en JPG, o la foto original si eligió "Foto completa"
  // (o si no se pudo abrir para recortar)
  async function archivoFinal() {
    const original = input.files[0];
    if (!original || !imagen || modo === 'completa') return original;
    const v = ventana();
    const lienzo = document.createElement('canvas');
    lienzo.width = RECORTE_ANCHO;
    lienzo.height = RECORTE_ALTO;
    const x = centroX * imagen.naturalWidth - v.ancho / 2;
    const y = centroY * imagen.naturalHeight - v.alto / 2;
    // drawImage(foto, de dónde recortar (x, y, ancho, alto), dónde dibujarlo (todo el lienzo))
    lienzo.getContext('2d').drawImage(imagen, x, y, v.ancho, v.alto, 0, 0, RECORTE_ANCHO, RECORTE_ALTO);
    const blob = await new Promise(ok => lienzo.toBlob(ok, 'image/jpeg', 0.9));
    const nombre = original.name.replace(/\.[^.]+$/, '') + '-recorte.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  }

  return { archivoFinal, limpiar };
}
