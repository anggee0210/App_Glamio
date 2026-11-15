// ===============================
// GLAMIO – Servidor principal
// ===============================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares generales ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'glamio-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));

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

// --- Ruta no encontrada en la API ---
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// --- Manejo de errores ---
app.use((err, req, res, next) => {
  // Errores de multer (archivo demasiado grande, etc.): son de los datos enviados → 400
  if (err.name === 'MulterError') {
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'El archivo es demasiado grande (máximo 50 MB). Los vídeos largos, por YouTube.';
  }
  const estado = err.status || 500;
  if (estado === 500) console.error(err); // solo apuntamos los fallos de verdad del servidor
  res.status(estado).json({ error: err.message || 'Error del servidor' });
});

app.listen(PORT, () => {
  console.log(`GLAMIO funcionando en http://localhost:${PORT}`);
});
