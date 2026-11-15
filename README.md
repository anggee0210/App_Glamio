[README.md](https://github.com/user-attachments/files/34886891/README.md)
# GLAMIO 💅

App web de formación en belleza (uñas, cabello y cejas): academia de cursos, comunidad, calculadora de precios y reseñas verificadas.

**Recorrido clave:** aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.

## Stack
- Frontend: HTML, CSS, JavaScript (fetch), diseño móvil
- Backend: Node.js + Express (API REST)
- Base de datos: PostgreSQL (`pg`)
- Login: `express-session` + `bcrypt`
- Archivos: `multer` (imágenes y videos cortos); videos largos por enlace de YouTube

## Estructura

```
glamio/
├── server.js              # Servidor Express y montaje de rutas
├── package.json
├── .env.example           # Copiar como .env
├── db/
│   ├── pool.js            # Conexión a PostgreSQL
│   ├── schema.sql         # Tablas de la fase 1
│   ├── seed.sql           # Categorías y cursos de ejemplo
│   └── crear-admin.js     # Crea la cuenta de administradora
├── middleware/
│   ├── auth.js            # requiereLogin / requiereAdmin
│   └── subidas.js         # Configuración de multer
├── routes/
│   ├── auth.js            # Registro, login, logout
│   ├── categorias.js      # Uñas, Cabello, Cejas...
│   ├── cursos.js          # Cursos, inscripción, progreso, certificado
│   ├── lecciones.js       # Lecciones y "marcar como completada"
│   ├── dudas.js           # Dudas con foto, respuestas, destacada
│   ├── trabajos.js        # Muro de trabajos
│   ├── resenas.js         # Reseñas de cursos terminados
│   ├── servicios.js       # Calculadora "Calcular mi precio"
│   └── reportes.js        # Reportar y moderar
├── public/
│   ├── index.html         # Catálogo de cursos con filtro por categoría
│   ├── login.html / registro.html
│   ├── curso.html         # Detalle, progreso, materiales y reseñas
│   ├── leccion.html       # Video + dudas de la lección
│   ├── certificado.html   # Certificado imprimible
│   ├── calculadora.html   # Calcular mi precio
│   ├── muro.html          # Muro de trabajos
│   ├── admin.html         # Panel de administradora
│   ├── css/estilos.css
│   └── js/api.js          # fetch + funciones comunes
└── uploads/               # Archivos subidos (imagenes/ y videos/)
```

## Puesta en marcha (local)

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear la base de datos en PostgreSQL:
   ```bash
   createdb -U postgres glamio
   npm run db:crear
   npm run db:datos
   ```
3. Copiar `.env.example` a `.env` y poner tu contraseña de PostgreSQL.
4. Crear la administradora:
   ```bash
   node db/crear-admin.js "Ana" admin@glamio.com 123456
   ```
5. Arrancar:
   ```bash
   npm run dev
   ```
   Abrir http://localhost:3000

## Reglas que cumple el código
- Reseña de curso solo si la inscripción está terminada (`routes/resenas.js`).
- Una reseña por alumna y curso (`UNIQUE` en `resenas_cursos`).
- Solo la administradora crea cursos, lecciones y marca respuestas destacadas (`requiereAdmin`).
- Las fotos van a Mi Estilo solo con la casilla de permiso marcada (`permiso_mi_estilo`).
- Lo reportado se oculta hasta que la administradora lo revise.
- El pago es simulado.

## Fases
1. **Academia** (esta entrega)
2. Clientas: Mi Estilo, perfil público, reseñas de profesionales
3. Tienda / Stock
4. Otras academias publican cursos
