// Datos de la academia: por ahora, el diseño del certificado
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin } = require('../middleware/auth');
const { subir, rutaPublica, borrarArchivo } = require('../middleware/subidas');
const router = express.Router();

// Fase 1: solo hay una academia (GLAMIO). En la fase 4 cada academia tendrá la suya.
const ACADEMIA_ID = 1;
const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/; // formato "#rrggbb", el que da <input type="color">
const FORMAS_LOGO = ['cuadrado', 'redondo', 'desvanecido']; // las mismas que permite la base de datos

// Convierte la fila de la base en lo que necesita la página
function diseno(fila) {
  return {
    fondo: fila.cert_fondo,
    firma: fila.cert_firma,
    logo: fila.cert_logo,
    logo_forma: fila.cert_logo_forma || 'desvanecido',
    posiciones: fila.cert_posiciones,   // null = las de por defecto (public/js/certificado-plantilla.js)
    directora: fila.cert_directora,
    color_texto: fila.cert_color_texto || '#3a2f36'
  };
}

// GET /api/academia/certificado → diseño actual (público: lo usa la página del certificado)
router.get('/certificado', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM academias WHERE id = $1', [ACADEMIA_ID]);
    res.json(diseno(rows[0]));
  } catch (err) { next(err); }
});

// PUT /api/academia/certificado  (solo admin)
// Llegan hasta TRES archivos a la vez (fondo, firma y logo), por eso se usa subir.fields() en vez de subir.single()
const subirImagenes = subir.fields([{ name: 'fondo', maxCount: 1 }, { name: 'firma', maxCount: 1 }, { name: 'logo', maxCount: 1 }]);

router.put('/certificado', requiereAdmin, subirImagenes, async (req, res, next) => {
  // Los archivos nuevos (si los hay) y una función para borrarlos si algo falla
  const nuevoFondo = req.files && req.files.fondo ? req.files.fondo[0] : null;
  const nuevaFirma = req.files && req.files.firma ? req.files.firma[0] : null;
  const nuevoLogo = req.files && req.files.logo ? req.files.logo[0] : null;
  const descartarNuevos = () => { borrarArchivo(rutaPublica(nuevoFondo)); borrarArchivo(rutaPublica(nuevaFirma)); borrarArchivo(rutaPublica(nuevoLogo)); };

  try {
    const { directora, color_texto, quitar_fondo, quitar_firma, quitar_logo, logo_forma } = req.body;
    for (const archivo of [nuevoFondo, nuevaFirma, nuevoLogo]) {
      if (archivo && !archivo.mimetype.startsWith('image/')) {
        descartarNuevos();
        return res.status(400).json({ error: 'El fondo, la firma y el logo tienen que ser imágenes' });
      }
    }
    if (logo_forma && !FORMAS_LOGO.includes(logo_forma)) {
      descartarNuevos();
      return res.status(400).json({ error: 'La forma del logo tiene que ser cuadrado, redondo o desvanecido' });
    }
    if (color_texto && !COLOR_VALIDO.test(color_texto)) {
      descartarNuevos();
      return res.status(400).json({ error: 'El color no es válido' });
    }

    const antes = (await pool.query('SELECT * FROM academias WHERE id = $1', [ACADEMIA_ID])).rows[0];

    // Para cada imagen: si llega una nueva se usa; si se marca "quitar" se deja vacía; si no, se queda la que había
    const marcado = valor => valor === 'on' || valor === 'true';
    const fondo = nuevoFondo ? rutaPublica(nuevoFondo) : (marcado(quitar_fondo) ? null : antes.cert_fondo);
    const firma = nuevaFirma ? rutaPublica(nuevaFirma) : (marcado(quitar_firma) ? null : antes.cert_firma);
    const logo = nuevoLogo ? rutaPublica(nuevoLogo) : (marcado(quitar_logo) ? null : antes.cert_logo);

    const { rows } = await pool.query(
      `UPDATE academias SET cert_fondo = $1, cert_firma = $2, cert_logo = $3, cert_logo_forma = $4, cert_directora = $5, cert_color_texto = $6
       WHERE id = $7 RETURNING *`,
      [fondo, firma, logo, logo_forma || antes.cert_logo_forma, directora || null, color_texto || antes.cert_color_texto, ACADEMIA_ID]);

    // Las imágenes viejas que ya no se usan se borran del disco
    if (antes.cert_fondo && antes.cert_fondo !== fondo) borrarArchivo(antes.cert_fondo);
    if (antes.cert_firma && antes.cert_firma !== firma) borrarArchivo(antes.cert_firma);
    if (antes.cert_logo && antes.cert_logo !== logo) borrarArchivo(antes.cert_logo);
    res.json(diseno(rows[0]));
  } catch (err) { descartarNuevos(); next(err); }
});

// ---------- Posiciones de los datos sobre la plantilla ----------
// Los mismos datos y límites de tamaño que ELEMENTOS_CERT en public/js/certificado-plantilla.js
const TAMANOS = {
  nombre: [1.5, 8], curso: [1, 6], logo: [5, 40], firma: [4, 25], datos: [0.7, 2.5]
};
const SIEMPRE_VISIBLES = ['nombre', 'curso'];
const esNumeroEntre = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

// Comprueba lo que llega del editor y devuelve un objeto limpio, o un texto con el error.
// Solo se guardan las claves conocidas: así nadie mete datos raros en la base.
function limpiarPosiciones(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return 'Faltan las posiciones';
  const limpio = {};
  for (const clave of Object.keys(entrada)) {
    if (!TAMANOS[clave]) return 'Dato desconocido: ' + clave;
    const { x, y, t, ver } = entrada[clave] || {};
    const [min, max] = TAMANOS[clave];
    if (!esNumeroEntre(x, 0, 100) || !esNumeroEntre(y, 0, 100)) return 'La posición tiene que estar dentro del certificado';
    if (!esNumeroEntre(t, min, max)) return `El tamaño de «${clave}» tiene que estar entre ${min} y ${max}`;
    if (typeof ver !== 'boolean') return 'Falta indicar si se muestra';
    if (!ver && SIEMPRE_VISIBLES.includes(clave)) return 'El nombre y el curso no se pueden ocultar';
    // Redondeo a 2 decimales: suficiente precisión y JSON más corto
    const r = n => Math.round(n * 100) / 100;
    limpio[clave] = { x: r(x), y: r(y), t: r(t), ver };
  }
  return limpio;
}

// PUT /api/academia/certificado/posiciones  (solo admin)
// Body JSON: { posiciones: {nombre: {x, y, t, ver}, ...} }  o  { posiciones: null } para volver a las de por defecto
router.put('/certificado/posiciones', requiereAdmin, async (req, res, next) => {
  try {
    let valor = null;
    if (req.body.posiciones !== null) {
      valor = limpiarPosiciones(req.body.posiciones);
      if (typeof valor === 'string') return res.status(400).json({ error: valor });
    }
    const { rows } = await pool.query(
      'UPDATE academias SET cert_posiciones = $1 WHERE id = $2 RETURNING *',
      [valor === null ? null : JSON.stringify(valor), ACADEMIA_ID]);
    res.json(diseno(rows[0]));
  } catch (err) { next(err); }
});

module.exports = router;
