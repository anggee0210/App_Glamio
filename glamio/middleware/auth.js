// Comprueba que hay sesión iniciada
function requiereLogin(req, res, next) {
  if (!req.session.usuaria) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }
  next();
}

// Comprueba que la usuaria es administradora
function requiereAdmin(req, res, next) {
  if (!req.session.usuaria || req.session.usuaria.perfil !== 'administradora') {
    return res.status(403).json({ error: 'Solo la administradora puede hacer esto' });
  }
  next();
}

// Comprueba que la usuaria tiene uno de los perfiles indicados.
// Uso: router.post('/', requierePerfil('alumna', 'profesional'), ...)
// Es una función que DEVUELVE un middleware: así se le pueden pasar los perfiles.
function requierePerfil(...perfiles) {
  return (req, res, next) => {
    if (!req.session.usuaria) {
      return res.status(401).json({ error: 'Debes iniciar sesión' });
    }
    if (!perfiles.includes(req.session.usuaria.perfil)) {
      return res.status(403).json({ error: 'Tu perfil no puede hacer esto' });
    }
    next();
  };
}

module.exports = { requiereLogin, requiereAdmin, requierePerfil };
