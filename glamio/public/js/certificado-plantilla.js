// =====================================================================
// CERTIFICADO CON PLANTILLA: dónde va cada dato encima del fondo subido.
// Lo usan certificado.html (el certificado de verdad) y admin.html (el editor
// donde la administradora arrastra los datos). Así los dos se ven IGUAL.
// =====================================================================

// Cada dato tiene:
//   x, y → dónde está su CENTRO, en % del ancho (x) y del alto (y) de la hoja
//   t    → su tamaño: letra (en % del ancho) para los textos,
//          ancho (%) para el logo y alto (%) para la firma
//   ver  → si se muestra o no (nombre y curso se muestran siempre)
// Estos valores por defecto encajan con la plantilla «Certificado de Reconocimiento».
const POSICIONES_CERT = {
  nombre: { x: 50,   y: 45,   t: 4.2,  ver: true },
  curso:  { x: 50,   y: 60,   t: 2.8,  ver: true },
  logo:   { x: 85,   y: 19.5, t: 17,   ver: true },
  firma:  { x: 46.7, y: 80.5, t: 12,   ver: true },
  datos:  { x: 14,   y: 91,   t: 1.05, ver: true }
};

// Nombre que ve la administradora, límites de la barra de tamaño y si se puede ocultar.
// (El servidor comprueba los mismos límites en routes/academia.js)
const ELEMENTOS_CERT = {
  nombre: { etiqueta: 'Nombre de la alumna', min: 1.5, max: 8,  ocultable: false },
  curso:  { etiqueta: 'Curso',               min: 1,   max: 6,  ocultable: false },
  logo:   { etiqueta: 'Logo',                min: 5,   max: 40, ocultable: true },
  firma:  { etiqueta: 'Firma',               min: 4,   max: 25, ocultable: true },
  datos:  { etiqueta: 'Fecha y Nº',          min: 0.7, max: 2.5, ocultable: true }
};

// Junta lo guardado con los valores por defecto (si falta algo, se usa el de por defecto)
function mezclarPosiciones(guardadas) {
  const resultado = {};
  for (const clave in POSICIONES_CERT) {
    resultado[clave] = { ...POSICIONES_CERT[clave], ...((guardadas && guardadas[clave]) || {}) };
  }
  return resultado;
}

// Estilo en línea de un dato: su centro en (x, y) y su tamaño según el tipo
function estiloDato(clave, p) {
  let tam = `font-size:${p.t}cqw`;                 // textos
  if (clave === 'logo') tam = `width:${p.t}%`;     // el logo: ancho
  if (clave === 'firma') tam = `height:${p.t}%`;   // la firma: alto
  return `left:${p.x}%;top:${p.y}%;${tam}`;
}

// HTML de los datos encima del fondo.
//   c = datos del certificado (nombre, titulo, fecha, numero)
//   d = diseño (logo, logo_forma, firma)
// En el editor del Panel se usa lo mismo: lo borrado o sin imagen NO se dibuja (sin sombras).
// Para recuperarlo están los botones de debajo del editor.
function htmlPlantilla(c, d, posiciones) {
  const pos = mezclarPosiciones(posiciones);
  const fecha = new Date(c.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const numero = 'GLAMIO-' + String(c.numero).padStart(5, '0');

  const contenido = {
    nombre: esc(c.nombre),
    curso: esc(c.titulo),
    logo: d.logo ? `<img src="${d.logo}" alt="Logo">` : '',
    firma: d.firma ? `<img src="${d.firma}" alt="Firma">` : '',
    datos: `Terminado el ${fecha}<br>Nº ${numero}`
  };

  let html = '';
  for (const clave in pos) {
    const p = pos[clave];
    if (!contenido[clave]) continue;              // logo o firma sin imagen: no sale
    if (!p.ver) continue;                         // borrado: no sale
    const clases = ['cert-el', 'cert-el-' + clave];
    if (clave === 'logo') clases.push('forma-logo', 'forma-' + (d.logo_forma || 'desvanecido'));
    html += `<div class="${clases.join(' ')}" data-el="${clave}" style="${estiloDato(clave, p)}">${contenido[clave]}</div>`;
  }
  return html;
}
