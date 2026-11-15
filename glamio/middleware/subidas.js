// Configuración de multer para subir imágenes y videos cortos
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const almacen = multer.diskStorage({
  destination: (req, file, cb) => {
    const carpeta = file.mimetype.startsWith('video/') ? 'videos' : 'imagenes';
    cb(null, path.join(__dirname, '..', 'uploads', carpeta));
  },
  filename: (req, file, cb) => {
    const nombre = Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname);
    cb(null, nombre);
  }
});

function filtro(req, file, cb) {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    const error = new Error('Solo se permiten imágenes o videos');
    error.status = 400; // es un fallo de los datos enviados, no del servidor
    cb(error);
  }
}

// Límite 50 MB (videos cortos). Los largos van por enlace de YouTube.
const subir = multer({ storage: almacen, fileFilter: filtro, limits: { fileSize: 50 * 1024 * 1024 } });

// Devuelve la ruta pública del archivo subido
function rutaPublica(file) {
  if (!file) return null;
  const carpeta = file.mimetype.startsWith('video/') ? 'videos' : 'imagenes';
  return `/uploads/${carpeta}/${file.filename}`;
}

// Borra un archivo de uploads/ a partir de su ruta pública ("/uploads/videos/x.mp4").
// Se usa al rechazar una petición o al cambiar una imagen o un vídeo por otro,
// para que no se queden archivos sueltos ocupando espacio.
function borrarArchivo(ruta) {
  if (!ruta || !ruta.startsWith('/uploads/')) return;
  fs.unlink(path.join(__dirname, '..', ruta), () => {}); // si ya no existe, no pasa nada
}

// Responde con un error y borra el archivo que multer acaba de guardar
// (multer guarda el archivo ANTES de que la ruta pueda comprobar los datos)
function rechazar(req, res, estado, mensaje) {
  borrarArchivo(rutaPublica(req.file));
  return res.status(estado).json({ error: mensaje });
}

module.exports = { subir, rutaPublica, borrarArchivo, rechazar };
