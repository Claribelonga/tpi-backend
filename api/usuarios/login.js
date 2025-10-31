const router = require('express').Router();
const db = require('../../conexion');
const { verificarPass, generarToken } = require('@damianegreco/hashpass');

const { TOKEN_SECRET } = process.env;

router.post('/', function(req, res) {
  const { user, pass } = req.body;
  console.log(user, pass);

  const sql = "SELECT id_usuario, email, contraseña, id_rol FROM usuarios WHERE email = ?";

  db.query(sql, [user])
    .then(([usuarios]) => {
       
      if (usuarios && usuarios.length === 1) {
        const usuario = usuarios[0];

        if (verificarPass(pass, usuario.contraseña)) {
          const token = generarToken(
            TOKEN_SECRET,
            4,
            {
              id: usuario.id_usuario,
              user: usuario.email,
              rol: usuario.id_rol //  Incluye el rol en el token
            }
          );

          res.status(200).json({ status: "ok", token });
        } else {
          res.status(401).send("Usuario y/o contraseña incorrecto");
        }
      } else {
        res.status(401).send("Usuario y/o contraseña incorrecto");
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("Ocurrió un error");
    });
});

module.exports = router;
