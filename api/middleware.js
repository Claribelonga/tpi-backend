const { verificarToken } = require('@damianegreco/hashpass');
const { TOKEN_SECRET } = process.env;

// Middleware base: verifica token y adjunta datos del usuario
function auth(req, res, next) {
  const token = req.headers.authorization;

  const verificacion = verificarToken(token, TOKEN_SECRET);

  if (verificacion?.data) {
    req.user = verificacion.data;
    next();
  } else {
    res.status(401).send("Sin autorización");
  }
}

// Middleware adicional: verifica si el rol está permitido
function verificarRol(...rolesPermitidos) {
  return function (req, res, next) {
    const rolUsuario = req.user?.rol;

    if (rolesPermitidos.includes(rolUsuario)) {
      next();
    } else {
      res.status(403).send("Acceso denegado");
    }
  };
}

module.exports = {
  auth,
  verificarRol
};
