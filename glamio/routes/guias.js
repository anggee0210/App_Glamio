// Guías teóricas (PDF) que se venden en cada curso, con pago simulado.
// Los PDF se guardan en privado/guias/, que NO es pública: solo se descargan por
// GET /api/guias/:id/descargar, y solo quien la compró (o la administradora).
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db/pool');
const { requiereLogin, requiereAdmin, requierePerfil } = require('../middleware/auth');
const { esId } = require('../middleware/permisos');
const router = express.Router();

const CARPETA = path.join(__dirname, '..', 'privado', 'guias');
fs.mkdirSync(CARPETA, { recursive: true });

// multer solo para PDF de hasta 100 MB (las guías con muchas fotos pesan bastante)
const MAX_MB_GUIA = 100;
const subirPdf = multer({
  storage: multer.diskStorage({
    destination: CARPETA,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + '.pdf')
  }),
  limits: { fileSize: MAX_MB_GUIA * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    const error = new Error('La guía tiene que ser un PDF');
    error.status = 400;
    cb(error);
  }
});
const borrarPdf = (nombre) => { if (nombre) fs.unlink(path.join(CARPETA, path.basename(nombre)), () => {}); };
const rechazar = (req, res, estado, error) => { if (req.file) borrarPdf(req.file.filename); res.status(estado).json({ error }); };

// GET /api/guias?curso=1 → guías del curso (pública). Si hay sesión, dice cuáles tiene ya.
router.get('/', async (req, res, next) => {
  try {
    if (!esId(req.query.curso)) return res.status(400).json({ error: 'Falta el curso' });
    const usuariaId = req.session.usuaria ? req.session.usuaria.id : null;
    const { rows } = await pool.query(
      `SELECT g.id, g.curso_id, g.titulo, g.descripcion, g.precio, g.creada_en,
              EXISTS (SELECT 1 FROM compras_guias c WHERE c.guia_id = g.id AND c.usuaria_id = $2) AS comprada,
              (SELECT COUNT(*) FROM compras_guias c WHERE c.guia_id = g.id)::int AS ventas
       FROM guias g WHERE g.curso_id = $1 ORDER BY g.id`, [req.query.curso, usuariaId]);
    // El número de ventas solo lo ve la administradora
    const esAdmin = req.session.usuaria && req.session.usuaria.perfil === 'administradora';
    if (!esAdmin) rows.forEach(g => delete g.ventas);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/guias (solo admin) → curso_id, titulo, descripcion, precio y el PDF ("archivo")
router.post('/', requiereAdmin, subirPdf.single('archivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube el PDF de la guía' });
    const { curso_id } = req.body;
    const titulo = String(req.body.titulo ?? '').trim();
    const descripcion = String(req.body.descripcion ?? '').trim();
    const precio = Number(req.body.precio || 0);
    if (!esId(curso_id)) return rechazar(req, res, 400, 'Elige el curso');
    if (!titulo) return rechazar(req, res, 400, 'Pon un título a la guía');
    if (titulo.length > 150) return rechazar(req, res, 400, 'El título es demasiado largo (máximo 150)');
    if (!Number.isFinite(precio) || precio < 0 || precio > 9999) return rechazar(req, res, 400, 'El precio debe estar entre 0 y 9999 €');
    const curso = await pool.query('SELECT 1 FROM cursos WHERE id = $1', [curso_id]);
    if (!curso.rows[0]) return rechazar(req, res, 404, 'Ese curso no existe');
    const { rows } = await pool.query(
      `INSERT INTO guias (curso_id, titulo, descripcion, precio, archivo) VALUES ($1, $2, $3, $4, $5) RETURNING id, curso_id, titulo, precio`,
      [curso_id, titulo, descripcion || null, precio, req.file.filename]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (req.file) borrarPdf(req.file.filename);
    next(err);
  }
});

// DELETE /api/guias/:id (solo admin) → borra la guía, su PDF y sus compras
router.delete('/:id', requiereAdmin, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Guía no encontrada' });
    const { rows } = await pool.query('DELETE FROM guias WHERE id = $1 RETURNING archivo', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Guía no encontrada' });
    borrarPdf(rows[0].archivo);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/guias/:id/comprar (alumna, profesional) → { pago_simulado: true } si es de pago
router.post('/:id/comprar', requierePerfil('alumna', 'profesional'), async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Guía no encontrada' });
    const guia = (await pool.query('SELECT precio FROM guias WHERE id = $1', [req.params.id])).rows[0];
    if (!guia) return res.status(404).json({ error: 'Guía no encontrada' });
    if (Number(guia.precio) > 0 && !(req.body && req.body.pago_simulado === true)) {
      return res.status(400).json({ error: 'Esta guía es de pago: confirma el pago simulado' });
    }
    const { rows } = await pool.query(
      `INSERT INTO compras_guias (usuaria_id, guia_id, importe) VALUES ($1, $2, $3)
       ON CONFLICT (usuaria_id, guia_id) DO NOTHING RETURNING id`,
      [req.session.usuaria.id, req.params.id, Number(guia.precio)]);
    if (!rows[0]) return res.json({ mensaje: 'Ya la tenías' });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/guias/:id/descargar → el PDF, solo para quien la compró o la administradora
router.get('/:id/descargar', requiereLogin, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Guía no encontrada' });
    const guia = (await pool.query('SELECT titulo, archivo FROM guias WHERE id = $1', [req.params.id])).rows[0];
    if (!guia) return res.status(404).json({ error: 'Guía no encontrada' });
    const esAdmin = req.session.usuaria.perfil === 'administradora';
    // La vista previa (?ver=1) es solo para la administradora: las alumnas descargan la guía que compraron
    if (req.query.ver === '1' && !esAdmin) {
      return res.status(403).json({ error: 'La vista previa es solo para la administradora' });
    }
    if (!esAdmin) {
      const compra = await pool.query('SELECT 1 FROM compras_guias WHERE guia_id = $1 AND usuaria_id = $2',
        [req.params.id, req.session.usuaria.id]);
      if (!compra.rows[0]) return res.status(403).json({ error: 'Compra la guía para descargarla' });
    }
    // path.basename: aunque alguien manipulara el nombre, nunca sale de privado/guias
    const nombre = guia.titulo.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'guia';
    const ruta = path.join(CARPETA, path.basename(guia.archivo));
    // ?ver=1 → vista previa: el navegador lo abre en su visor de PDF en vez de descargarlo
    if (req.query.ver === '1') {
      res.type('application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nombre)}.pdf`);
      return res.sendFile(ruta);
    }
    res.download(ruta, nombre + '.pdf');
  } catch (err) { next(err); }
});

module.exports = router;
