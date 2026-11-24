// Muro de trabajos etiquetados por curso
const express = require('express');
const pool = require('../db/pool');
const { requierePerfil } = require('../middleware/auth');
const { subir, rutaPublica, rechazar, borrarArchivo } = require('../middleware/subidas');
const { esId } = require('../middleware/permisos');
const router = express.Router();

// Quien estudia o trabaja en GLAMIO ve todo el muro.
// La clienta (y quien entra sin cuenta) solo ve los trabajos con permiso de su autora.
const VEN_TODO_EL_MURO = ['alumna', 'profesional', 'administradora'];
// Solo publican quienes hacen los trabajos: alumnas y profesionales (la clienta solo mira)
const puedePublicar = requierePerfil('alumna', 'profesional');
const MAX_DESCRIPCION = 500;

// GET /api/trabajos?categoria=1&curso=2
router.get('/', async (req, res, next) => {
  try {
    const { categoria, curso } = req.query;
    if (categoria && !esId(categoria)) return res.status(400).json({ error: 'Categoría no válida' });
    if (curso && !esId(curso)) return res.status(400).json({ error: 'Curso no válido' });

    let sql = `SELECT t.*, u.nombre, c.titulo AS curso, c.categoria_id
               FROM trabajos t JOIN usuarias u ON u.id = t.usuaria_id
               LEFT JOIN cursos c ON c.id = t.curso_id
               WHERE t.oculto = FALSE`; // oculto = reportado y pendiente de revisar
    const params = [];
    // El filtro se hace AQUÍ, en el servidor: si solo se ocultaran en la página,
    // las fotos sin permiso seguirían llegando al navegador de la clienta.
    const perfil = req.session.usuaria ? req.session.usuaria.perfil : null;
    if (!VEN_TODO_EL_MURO.includes(perfil)) sql += ' AND t.permiso_mi_estilo = TRUE';
    if (categoria) { params.push(categoria); sql += ` AND c.categoria_id = $${params.length}`; }
    if (curso) { params.push(curso); sql += ` AND t.curso_id = $${params.length}`; }
    sql += ' ORDER BY t.fecha DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/trabajos/mis-cursos → los cursos que puedo poner en la etiqueta (en los que estoy inscrita)
router.get('/mis-cursos', puedePublicar, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.titulo FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
       WHERE i.usuaria_id = $1 ORDER BY c.titulo`, [req.session.usuaria.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/trabajos  (foto obligatoria; permiso para clientas explícito)
// multer guarda la foto antes de que comprobemos nada: cada rechazo usa rechazar(), que la borra.
router.post('/', puedePublicar, subir.single('foto'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube una foto de tu trabajo' });
    if (!req.file.mimetype.startsWith('image/')) return rechazar(req, res, 400, 'El trabajo tiene que ser una foto (los vídeos no van al muro)');

    const descripcion = String(req.body.descripcion ?? '').trim();
    if (descripcion.length > MAX_DESCRIPCION)
      return rechazar(req, res, 400, `La descripción es demasiado larga (máximo ${MAX_DESCRIPCION} caracteres)`);

    // Etiqueta de curso: opcional, pero solo de un curso en el que esté inscrita.
    // Así la etiqueta es de fiar: "Manicura básica" = lo ha estudiado en GLAMIO.
    const cursoId = req.body.curso_id || null;
    if (cursoId) {
      if (!esId(cursoId)) return rechazar(req, res, 400, 'Curso no válido');
      const insc = await pool.query('SELECT 1 FROM inscripciones WHERE usuaria_id = $1 AND curso_id = $2',
        [req.session.usuaria.id, cursoId]);
      if (!insc.rows[0]) return rechazar(req, res, 400, 'Solo puedes etiquetar cursos en los que estás inscrita');
    }

    const permiso = req.body.permiso_mi_estilo === 'true' || req.body.permiso_mi_estilo === 'on';
    const { rows } = await pool.query(
      `INSERT INTO trabajos (usuaria_id, curso_id, foto, descripcion, permiso_mi_estilo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.session.usuaria.id, cursoId, rutaPublica(req.file), descripcion || null, permiso]);
    res.status(201).json(rows[0]);
  } catch (err) {
    borrarArchivo(rutaPublica(req.file)); // si falla la base de datos, la foto tampoco se queda
    next(err);
  }
});

// PUT /api/trabajos/:id/permiso  { permiso_mi_estilo: true|false }
// Solo la autora decide si las clientas ven su foto (consentimiento, RGPD)
router.put('/:id/permiso', puedePublicar, async (req, res, next) => {
  try {
    if (!esId(req.params.id)) return res.status(404).json({ error: 'Ese trabajo no existe o no es tuyo' });
    const permiso = req.body.permiso_mi_estilo;
    if (typeof permiso !== 'boolean') return res.status(400).json({ error: 'Indica si das permiso (sí o no)' });
    // usuaria_id en el WHERE: nadie puede cambiar el permiso de una foto ajena
    const { rows } = await pool.query(
      'UPDATE trabajos SET permiso_mi_estilo = $1 WHERE id = $2 AND usuaria_id = $3 RETURNING *',
      [permiso, req.params.id, req.session.usuaria.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ese trabajo no existe o no es tuyo' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/trabajos/:id  → la autora retira su foto (RGPD: puede retirar su consentimiento)
router.delete('/:id', puedePublicar, async (req, res, next) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'Ese trabajo no existe o no es tuyo' });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      'DELETE FROM trabajos WHERE id = $1 AND usuaria_id = $2 RETURNING foto',
      [req.params.id, req.session.usuaria.id]);
    if (!rows[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Ese trabajo no existe o no es tuyo' });
    }
    // Los reportes no tienen clave foránea (pueden ser de 3 tablas): los quitamos a mano
    // para que no se quede en el Panel un reporte de algo que ya no existe.
    await cliente.query("DELETE FROM reportes WHERE tipo = 'trabajo' AND elemento_id = $1", [req.params.id]);
    await cliente.query('COMMIT');
    borrarArchivo(rows[0].foto); // la foto se borra del disco solo cuando la base ya lo ha confirmado
    res.json({ ok: true });
  } catch (err) {
    await cliente.query('ROLLBACK');
    next(err);
  } finally {
    cliente.release();
  }
});

module.exports = router;
