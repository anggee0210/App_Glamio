// ===============================
// GLAMIO – Servidor principal
// ===============================
require('dotenv').config();
const express = require('express');
const { cargarSesion } = require('./middleware/sesiones');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares generales ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones propias (tabla "sesiones" en PostgreSQL): en cada petición lee la cookie
// glamio_sesion y, si es válida, rellena req.session.usuaria. Ver middleware/sesiones.js
// (Va ANTES del contador de visitas, que necesita saber quién ha entrado.)
app.use(cargarSesion);

// --- Contador de visitas (estadísticas de la administradora) ---
// Cada página que se abre (/ o un .html) suma una fila en "visitas". Datos mínimos: página, fecha y,
// si ha entrado, quién (sin IP: RGPD). Se guarda "sin esperar": si falla, la página carga igual.
const pool = require('./db/pool');
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
    const pagina = (req.path === '/' ? '/index.html' : req.path).slice(0, 100);
    const usuariaId = req.session.usuaria ? req.session.usuaria.id : null;
    pool.query('INSERT INTO visitas (pagina, usuaria_id) VALUES ($1, $2)', [pagina, usuariaId]).catch(() => {});
  }
  next();
});

// --- Archivos estáticos ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Rutas de la API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/cursos', require('./routes/cursos'));
app.use('/api/lecciones', require('./routes/lecciones'));
app.use('/api/dudas', require('./routes/dudas'));
app.use('/api/trabajos', require('./routes/trabajos'));
app.use('/api/resenas', require('./routes/resenas'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/academia', require('./routes/academia'));
app.use('/api/certificados', require('./routes/certificados'));
app.use('/api/estadisticas', require('./routes/estadisticas'));
app.use('/api/guias', require('./routes/guias'));
app.use('/api/mi-estilo', require('./routes/mi-estilo')); // fase 2: favoritos de la clienta
app.use('/api/perfil', require('./routes/perfil'));       // fase 2: perfil público de alumna y profesional
app.use('/api/ficha', require('./routes/ficha'));         // ficha personal de la alumna (solo ella y la admin)

// --- Ruta no encontrada en la API ---
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// --- Manejo de errores ---
app.use((err, req, res, next) => {
  // Errores de multer (archivo demasiado grande, etc.): son de los datos enviados → 400
  if (err.name === 'MulterError') {
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      // Las guías PDF tienen su propio límite (100 MB); el resto de subidas, 50 MB
      err.message = req.originalUrl.startsWith('/api/guias')
        ? 'La guía es demasiado grande (máximo 100 MB).'
        : 'El archivo es demasiado grande (máximo 50 MB). Los vídeos largos, por YouTube.';
    }
  }
  const estado = err.status || 500;
  if (estado === 500) console.error(err); // solo apuntamos los fallos de verdad del servidor
  res.status(estado).json({ error: err.message || 'Error del servidor' });
});

app.listen(PORT, () => {
  console.log(`GLAMIO funcionando en http://localhost:${PORT}`);
});
