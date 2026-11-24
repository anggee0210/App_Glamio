# GLAMIO

App web de formación en belleza (**uñas, cabello y cejas**): academia de cursos, comunidad, calculadora de precios y reseñas verificadas.

**Recorrido clave:** aprendo → pregunto → sé cuánto cobrar → muestro mi resultado.

> 📘 **Documentación completa** (perfiles, funciones, puesta en marcha, demo y reglas): [`glamio/README.md`](glamio/README.md)

## Tecnologías

| Parte | Qué se usa |
|---|---|
| Frontend | HTML, CSS y JavaScript con `fetch` (diseño para PC y móvil) |
| Backend | Node.js + Express (API REST) |
| Base de datos | PostgreSQL con `pg` |
| Login | Sesiones propias en la tabla `sesiones` + contraseñas con **Argon2id** + email verificado |
| Archivos | `multer` (fotos, vídeos cortos y guías en PDF); vídeos largos por YouTube |
| Correo | `nodemailer` (simulado o Gmail) |

Todo funciona **en local** y el pago es **simulado**.

## Organización del repositorio

```
App_Glamio/
├── README.md          ← este archivo (resumen)
└── glamio/            ← la aplicación
    ├── server.js      # Servidor Express
    ├── db/            # Conexión, schema.sql, datos de ejemplo y migraciones
    ├── middleware/    # Sesiones, contraseñas, permisos, seguridad y subidas
    ├── routes/        # API REST, un archivo por módulo
    ├── public/        # Páginas HTML, CSS, JS e imágenes
    ├── test/          # Pruebas automáticas (node:test)
    ├── docs/          # Login seguro, casos de uso, diseño UX/UI
    ├── uploads/       # Fotos y vídeos subidos (fuera de git)
    └── privado/       # Guías en PDF, solo por la API (fuera de git)
```

## Arranque rápido

```bash
cd glamio
npm install
cp .env.example .env     # y rellenar los datos
npm start                # http://localhost:3000
```

Pruebas: `npm run test:simulado` · Copia de seguridad: `npm run copia`

## Ramas

- **`main`**: versión estable (la de la entrega).
- **`develop`**: donde se trabaja; se une a `main` cuando todo está probado.

## Fases

1. **Academia** (proyecto de clase): perfiles, panel de la administradora, cursos y lecciones, progreso y certificado, calculadora, Comunidad y reseñas ✅
2. **Clientas**: Mi Estilo ✅, perfil público ✅, reseñas de profesionales (pendiente)
3. **Tienda / Stock** (hay una vista previa en `public/simuladores/`)
4. Otras academias publican sus cursos
