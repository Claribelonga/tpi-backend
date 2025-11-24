const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");


const loginRouter = require("./login");

const {hashPass} = require('@damianegreco/hashpass');

router.use("/login", loginRouter);

//perfil, segun el cliente que se registre
router.get("/perfil",  auth, verificarRol(3), function(req, res) {
  const id_usuario = req.user?.id; // viene del token

  if (!id_usuario) {
    return res.status(401).send("Usuario no identificado");
  }

  const sql = `
    SELECT 
      u.id_usuario, u.email,
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
        return res.status(404).send("Perfil no encontrado");
      }
      res.send(rows[0]);
    })
    .catch((error) => {
      console.error("Error en GET /perfil:", error);
      res.status(500).send("Ocurrió un error al obtener el perfil");
    });
});

//lo usa el cliente para registrarse, sin loguearse
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

router.put("/editarperfil", auth, verificarRol(3), async function(req, res) {
  const id_usuario = req.user?.id;

  if (!id_usuario) {
    return res.status(401).send("Usuario no autenticado");
  }

  const {
    email,
    contraseña,
    nombre,
    apellido,
    dni,
    telefono,
    calle,
    numero,
    piso,
    departamento
  } = req.body;

  try {
    // 1. Obtener id_persona e id_direccion vinculados al usuario
    const sqlPersona = `
      SELECT p.id_persona, p.id_direccion
      FROM personas p
      WHERE p.id_usuario = ?
    `;
    const [personas] = await db.query(sqlPersona, [id_usuario]);

    if (!personas.length) {
      return res.status(404).send("Perfil no encontrado");
    }

    const { id_persona, id_direccion } = personas[0];

    // 2. Actualizar datos en tabla personas
    const sqlUpdatePersona = `
      UPDATE personas
      SET nombre = ?, apellido = ?, dni = ?, telefono = ?
      WHERE id_persona = ?
    `;
    await db.query(sqlUpdatePersona, [nombre, apellido, dni, telefono, id_persona]);

    // 3. Actualizar datos en tabla usuarios (email + contraseña si se envió)
    if (contraseña && contraseña.trim() !== "") {
      const hashedPassword = await hashPass(contraseña);
      const sqlUpdateUsuario = `
        UPDATE usuarios
        SET email = ?, contraseña = ?
        WHERE id_usuario = ?
      `;
      await db.query(sqlUpdateUsuario, [email, hashedPassword, id_usuario]);
    } else {
      const sqlUpdateUsuario = `
        UPDATE usuarios
        SET email = ?
        WHERE id_usuario = ?
      `;
      await db.query(sqlUpdateUsuario, [email, id_usuario]);
    }

    // 4. Actualizar datos en tabla direcciones
    const sqlUpdateDireccion = `
      UPDATE direcciones
      SET calle = ?, numero = ?, piso = ?, departamento = ?
      WHERE id_direccion = ?
    `;
    await db.query(sqlUpdateDireccion, [calle, numero, piso, departamento, id_direccion]);

    res.status(200).send("Perfil actualizado correctamente");
  } catch (error) {
    console.error("Error en PUT /editarperfil:", error);
    res.status(500).send("Ocurrió un error al actualizar el perfil");
  }
});


module.exports = router;