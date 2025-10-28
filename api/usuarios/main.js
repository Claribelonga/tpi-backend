const router = require("express").Router();
const db = require('../../conexion');

//const loginRouter = require("./login");

const {hashPass} = require('@damianegreco/hashpass');

//router.use("/login", loginRouter);

//perfil
router.get("/perfil/:id_usuario", function(req, res, next) {
  const { id_usuario } = req.params;

  const sql = `
    SELECT 
      u.id_usuario, u.email, u.contraseña,
      p.id_persona, p.nombre, p.apellido, p.dni, p.telefono, p.id_direccion,
      d.calle, d.numero, d.piso, d.departamento
    FROM usuarios u
    JOIN personas p ON u.id_usuario = p.id_usuario
    JOIN direcciones d ON p.id_direccion = d.id_direccion
    WHERE u.id_usuario = ?
  `;

  db.query(sql, [id_usuario])
    .then(([rows]) => {
      if (rows.length === 0) {
        return res.status(404).send("Usuario no encontrado");
      }
      res.send(rows[0]); // solo uno
    })
    .catch((error) => {
      console.error("Error en GET /perfil/:id_usuario:", error);
      res.status(500).send("Ocurrió un error al obtener el perfil del usuario");
    });
});


//lo usa el cliente para registrarse
router.post("/registro", function(req, res, next) {
  const {
    email, contraseña,
    nombre, apellido, dni, telefono,
    calle, numero, piso, departamento
  } = req.body;

  const passHash = hashPass(contraseña);
  const id_rol = 3;
  // 1. Insertar en usuarios
  const sqlUsuario = "INSERT INTO usuarios (email, contraseña, id_rol) VALUES (?, ?, ?)";
  db.query(sqlUsuario, [email, passHash, id_rol])
    .then(([resultUsuario]) => {
      const id_usuario = resultUsuario.insertId; //para saber el id que se creo
      

      // 2. Insertar en direcciones
      const sqlDireccion = "INSERT INTO direcciones (calle, numero, piso, departamento) VALUES (?, ?, ?, ?)";
      return db.query(sqlDireccion, [calle, numero, piso, departamento])
        .then(([resultDireccion]) => {
          const id_direccion = resultDireccion.insertId;
         

          // 3. Insertar en personas
          const sqlPersona = "INSERT INTO personas (nombre, apellido, dni, telefono, id_direccion, id_usuario) VALUES (?, ?, ?, ?, ?, ?)";
          return db.query(sqlPersona, [nombre, apellido, dni, telefono, id_direccion, id_usuario]);
        });
    })
    .then(() => {
      res.status(201).send("Usuario, dirección y persona guardados correctamente");
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("Ocurrió un error al guardar los datos");
    });
});

//el cliente actualiza su perfil
router.put("/editarperfil/:id_usuario", function(req, res, next) {
  const { id_usuario } = req.params;
  const {
    email, contraseña,
    nombre, apellido, dni, telefono,
    calle, numero, piso, departamento
  } = req.body;

  const passHash = hashPass(contraseña);

  // 1. Actualizar usuarios (sin id_rol)
  const sqlUsuario = "UPDATE usuarios SET email = ?, contraseña = ? WHERE id_usuario = ?";
  db.query(sqlUsuario, [email, passHash, id_usuario])
    .then(() => {
      // 2. Actualizar personas
      const sqlPersona = "UPDATE personas SET nombre = ?, apellido = ?, dni = ?, telefono = ? WHERE id_usuario = ?";
      return db.query(sqlPersona, [nombre, apellido, dni, telefono, id_usuario]);
    })
    .then(([rows]) => {
      // 3. Obtener id_direccion desde personas
      const sqlGetDireccion = "SELECT id_direccion FROM personas WHERE id_usuario = ?";
      return db.query(sqlGetDireccion, [id_usuario]);
    })
    .then(([rows]) => {
      if (rows.length === 0) throw new Error("No se encontró la persona asociada al usuario");

      const id_direccion = rows[0].id_direccion;

      // 4. Actualizar direcciones
      const sqlDireccion = "UPDATE direcciones SET calle = ?, numero = ?, piso = ?, departamento = ? WHERE id_direccion = ?";
      return db.query(sqlDireccion, [calle, numero, piso, departamento, id_direccion]);
    })
    .then(() => {
      res.status(200).send("Perfil completo actualizado");
    })
    .catch((error) => {
      console.error("Error al actualizar perfil completo:", error);
      res.status(500).send("Ocurrió un error al actualizar el perfil");
    });
});


module.exports = router;