// =====================================================================
// SIMULADORES (solo vista previa): datos de ejemplo compartidos
// Los usan tienda.html y citas.html (lo que ve la clienta) y
// productos.html y citas-agendadas.html (lo que ve la administradora).
// NO hay base de datos: todo se guarda en el navegador (localStorage),
// así que la administradora ve lo que se ha hecho en ESTE navegador.
// =====================================================================

const euros = n => Number(n).toFixed(2).replace('.', ',') + ' €';
const duracion = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`;
const inicialesSim = n => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
// Fecha local (no UTC) en formato '2026-11-25'
const claveDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const textoDia = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

// localStorage puede fallar (modo privado...): siempre con try/catch; si falla, se empieza de cero
function leerSim(clave, porDefecto) {
  try { const v = JSON.parse(localStorage.getItem(clave)); if (v !== null) return v; } catch (err) { /* sin datos guardados */ }
  return porDefecto;
}
function guardarSim(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (err) { /* solo se pierde al recargar */ }
}
function borrarSim(clave) {
  try { localStorage.removeItem(clave); } catch (err) { /* nada que borrar */ }
}

// ---------- TIENDA (fase 3) ----------
// En la fase 3 vendrían de las tablas productos e inventario
// foto: en /img/tienda/ (fotos libres de Unsplash, sin marcas visibles). icono: el dibujo de reserva si no hay foto.
const PRODUCTOS = [
  { id: 1, categoria: 'Uñas',    nombre: 'Esmaltes tonos nude',               detalle: 'Set de 4 semipermanentes · 10 ml',     precio: 8.90,  stock: 12, icono: 'esmalte', foto: '/img/tienda/esmalte-rosa.jpg' },
  { id: 2, categoria: 'Uñas',    nombre: 'Colección de 6 esmaltes',             detalle: 'Colores de temporada', precio: 29.90, stock: 3,  icono: 'esmalte', foto: '/img/tienda/esmaltes-colores.jpg' },
  { id: 3, categoria: 'Uñas',    nombre: 'Kit de manicura',                     detalle: 'Lima, tijera y palitos', precio: 15.50, stock: 10, icono: 'lima',  foto: '/img/tienda/kit-manicura.jpg' },
  { id: 4, categoria: 'Uñas',    nombre: 'Lámpara LED/UV 48 W',                 detalle: 'Secado 30-60 s',       precio: 39.00, stock: 4,  icono: 'lampara', foto: '/img/tienda/lampara-led.jpg' },
  { id: 5, categoria: 'Uñas',    nombre: 'Pincel de precisión nail art',        detalle: 'Punta fina',           precio: 9.90,  stock: 9,  icono: 'pincel',  foto: '/img/tienda/pinceles.jpg' },
  { id: 6, categoria: 'Cabello', nombre: 'Tijera de corte profesional',         detalle: '6 pulgadas · acero',   precio: 24.00, stock: 2,  icono: 'tijera',  foto: '/img/tienda/tijera.jpg' },
  { id: 9, categoria: 'Cabello', nombre: 'Cepillo desenredante',                detalle: 'Púas flexibles',       precio: 12.90, stock: 14, icono: 'tijera',  foto: '/img/tienda/cepillo.jpg' },
  { id: 10, categoria: 'Cabello', nombre: 'Secador profesional 2000 W',         detalle: 'Iónico · 3 temperaturas', precio: 49.00, stock: 3, icono: 'tijera', foto: '/img/tienda/secador.jpg' },
  { id: 11, categoria: 'Cabello', nombre: 'Kit de peinado',                     detalle: 'Secador, cepillo y peine', precio: 59.90, stock: 6, icono: 'tijera', foto: '/img/tienda/kit-peinado.jpg' },
  { id: 7, categoria: 'Cejas',   nombre: 'Pinzas de precisión',                 detalle: 'Set de 3 · acero',     precio: 7.50,  stock: 1,  icono: 'pinza',   foto: '/img/tienda/pinzas.jpg' },
  { id: 8, categoria: 'Cejas',   nombre: 'Kit de diseño de cejas',              detalle: 'Henna, pinza y guía',  precio: 19.90, stock: 8,  icono: 'henna',   foto: '/img/tienda/tratamiento-cejas.jpg' }
];
const POCAS = 3; // con 3 o menos unidades sale el aviso de stock bajo

// Dibujos de línea (SVG 64×64) para cada tipo de producto
const ICONOS_TIENDA = {
  esmalte: '<rect x="24" y="30" width="16" height="24" rx="5"/><path d="M28 30v-8h8v8"/><path d="M29 22V12h6v10"/>',
  lima:    '<rect x="14" y="27" width="36" height="10" rx="5" transform="rotate(-30 32 32)"/><path d="M22 38l4-7M28 35l4-7M34 32l4-7"/>',
  lampara: '<path d="M12 44c0-12 9-22 20-22s20 10 20 22"/><path d="M8 44h48v6H8z"/><path d="M24 34h16"/>',
  pincel:  '<path d="M42 12 26 38"/><path d="M26 38c-4 0-8 4-8 10 6 0 10-4 10-8z"/>',
  tinte:   '<path d="M22 20h20v30a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4z"/><path d="M26 20v-6h12v6"/><path d="M22 32h20"/>',
  tijera:  '<circle cx="20" cy="44" r="6"/><circle cx="20" cy="22" r="6"/><path d="M25 26 50 44M25 40 50 22"/>',
  henna:   '<rect x="18" y="26" width="28" height="22" rx="6"/><path d="M22 26c0-6 4-10 10-10s10 4 10 10"/><path d="M26 38c4-3 8-3 12 0"/>',
  pinza:   '<path d="M24 10 30 52M40 10 34 52"/><path d="M27 30h10"/>'
};
const claseCategoria = c => 'sim-' + (c === 'Uñas' ? 'unas' : c.toLowerCase());

// Estado de la tienda: carrito, stock de cada producto, pedidos hechos y productos ocultos por la administradora
const CLAVE_TIENDA = 'glamio-simulador-tienda-v2'; // v2: la lista con fotos (así no se mezcla con el stock de la lista anterior)
function estadoTiendaInicial() {
  return { carrito: {}, stock: Object.fromEntries(PRODUCTOS.map(p => [p.id, p.stock])), pedidos: 0, ocultos: [] };
}
function leerTienda() {
  const e = leerSim(CLAVE_TIENDA, null);
  if (!e || !e.carrito || !e.stock) return estadoTiendaInicial();
  if (!Array.isArray(e.ocultos)) e.ocultos = [];
  // Si la lista de productos ha cambiado: los nuevos empiezan con su stock y los que ya no existen se quitan
  const ids = PRODUCTOS.map(p => String(p.id));
  for (const p of PRODUCTOS) if (typeof e.stock[p.id] !== 'number') e.stock[p.id] = p.stock;
  for (const id of Object.keys(e.stock)) if (!ids.includes(id)) delete e.stock[id];
  for (const id of Object.keys(e.carrito)) if (!ids.includes(id)) delete e.carrito[id];
  e.ocultos = e.ocultos.filter(id => ids.includes(String(id)));
  return e;
}
const guardarTienda = e => guardarSim(CLAVE_TIENDA, e);

// ---------- CITAS (fase 2) ----------
// En la fase 2 vendrían de los perfiles públicos y de los servicios marcados como públicos
const PROFESIONALES = [
  { id: 1, nombre: 'Laura Martín', especialidad: 'Uñas', servicios: [
    { id: 11, nombre: 'Manicura semipermanente', minutos: 60, precio: 22.50 },
    { id: 12, nombre: 'Nail art (2 uñas)', minutos: 20, precio: 8.00 },
    { id: 13, nombre: 'Retirada de semipermanente', minutos: 30, precio: 10.00 } ] },
  { id: 2, nombre: 'Sofía Ramos', especialidad: 'Cejas', servicios: [
    { id: 21, nombre: 'Diseño de cejas con pinza', minutos: 30, precio: 12.00 },
    { id: 22, nombre: 'Henna de cejas', minutos: 45, precio: 18.00 } ] },
  { id: 3, nombre: 'Carla Vidal', especialidad: 'Cabello', servicios: [
    { id: 31, nombre: 'Color raíz', minutos: 90, precio: 35.00 },
    { id: 32, nombre: 'Corte y peinado', minutos: 60, precio: 25.00 } ] }
];
const HORAS = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'];

// Las citas que reserva la clienta en el simulador (en este navegador)
const CLAVE_CITAS = 'glamio-simulador-citas';
const leerCitas = () => { const c = leerSim(CLAVE_CITAS, []); return Array.isArray(c) ? c : []; };
const guardarCitas = c => guardarSim(CLAVE_CITAS, c);

// Citas de ejemplo de otras clientas, para que la administradora vea una agenda con datos.
// Las fechas se calculan desde hoy (siempre salen en los próximos días).
const CLAVE_CANCELADAS = 'glamio-simulador-citas-canceladas'; // ids de citas de ejemplo canceladas por la administradora
function citasDeEjemplo() {
  const ejemplo = [
    [0, '17:00', 'María López', 1, 11], [1, '10:30', 'Lucía Fernández', 2, 22], [1, '16:00', 'Paula Gil', 3, 32],
    [2, '11:00', 'Andrea Ruiz', 1, 12], [3, '12:00', 'Carmen Ortega', 3, 31], [5, '17:30', 'Elena Sanz', 2, 21]
  ];
  return ejemplo.map(([masDias, hora, clienta, profesional, servicio], i) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + masDias);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // los domingos no se trabaja
    const p = PROFESIONALES.find(x => x.id === profesional);
    const s = p.servicios.find(x => x.id === servicio);
    return { id: 'ej' + i, ejemplo: true, clienta, profesional, nombreProfesional: p.nombre, servicio: s.nombre,
      minutos: s.minutos, precio: s.precio, dia: claveDia(d), hora };
  });
}

// La imagen de un producto: su foto (o el dibujo de línea si no tiene)
function htmlImagenProducto(p) {
  return p.foto ? `<img src="${p.foto}" alt="${esc(p.nombre)}" loading="lazy">`
    : `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONOS_TIENDA[p.icono]}</svg>`;
}
