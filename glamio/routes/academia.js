// Datos de la academia: por ahora, el diseño del certificado
const express = require('express');
const pool = require('../db/pool');
const { requiereAdmin } = require('../middleware/auth');
const { subir, rutaPublica, borrarArchivo } = require('../middleware/subidas');
const router = express.Router();

// Fase 1: solo hay una academia (GLAMIO). En la fase 4 cada academia tendrá la suya.
const ACADEMIA_ID = 1;
const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/; // formato "#rrggbb", el que da <input type="color">

// Convierte la fila de la base en lo que necesita la página
function diseno(fila) {
  return {
    fondo: fila.cert_fondo,
    firma: fila.cert_firma,
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
// Llegan hasta DOS archivos a la vez (fondo y firma), por eso se usa subir.fields() en vez de subir.single()
const subirImagenes = subir.fields([{ name: 'fondo', maxCount: 1 }, { name: 'firma', maxCount: 1 }]);

router.put('/certificado', requiereAdmin, subirImagenes, async (req, res, next) => {
  // Los archivos nuevos (si los hay) y una función para borrarlos si algo falla
  const nuevoFondo = req.files && req.files.fondo ? req.files.fondo[0] : null;
  const nuevaFirma = req.files && req.files.firma ? req.files.firma[0] : null;
  const descartarNuevos = () => { borrarArchivo(rutaPublica(nuevoFondo)); borrarArchivo(rutaPublica(nuevaFirma)); };

  try {
    const { directora, color_texto, quitar_fondo, quitar_firma } = req.body;
    for (const archivo of [nuevoFondo, nuevaFirma]) {
      if (archivo && !archivo.mimetype.startsWith('image/')) {
        descartarNuevos();
        return res.status(400).json({ error: 'El fondo y la firma tienen que ser imágenes' });
      }
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

    const { rows } = await pool.query(
      `UPDATE academias SET cert_fondo = $1, cert_firma = $2, cert_directora = $3, cert_color_texto = $4
       WHERE id = $5 RETURNING *`,
      [fondo, firma, directora || null, color_texto || antes.cert_color_texto, ACADEMIA_ID]);

    // Las imágenes viejas que ya no se usan se borran del disco
    if (antes.cert_fondo && antes.cert_fondo !== fondo) borrarArchivo(antes.cert_fondo);
    if (antes.cert_firma && antes.cert_firma !== firma) borrarArchivo(antes.cert_firma);
    res.json(diseno(rows[0]));
  } catch (err) { descartarNuevos(); next(err); }
});

module.exports = router;
