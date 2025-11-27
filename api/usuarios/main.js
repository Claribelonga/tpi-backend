const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

const loginRouter = require("./login");

const {hashPass} = require('@damianegreco/hashpass');

router.use("/login", loginRouter);

//el cliente logueado ve su perfil
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
//el usuario no registrado, ingresa sus datos para poder loguearse
router.post("/registro", function(req, res, next) {
  const {
    email, contraseña,
    nombre, apellido, dni, telefono,
    calle, numero, piso, departamento
  } = req.body;

  const passHash = hashPass(contraseña);
  const id_rol = 3; // predeterminado ya que solo puede ser un cliente

  // 1. Validar duplicados
  const sqlCheck = "SELECT u.email, p.dni FROM usuarios u LEFT JOIN personas p ON u.id_usuario = p.id_usuario WHERE u.email = ? OR p.dni = ?";
  db.query(sqlCheck, [email, dni])
    .then(([rows]) => {
      if (rows.length > 0) {
        // Si ya existe email o DNI
        const existeEmail = rows.some(r => r.email === email);
        const existeDni = rows.some(r => r.dni === dni);

        if (existeEmail) {
          return res.status(409).send("El email ya está registrado");
        }
        if (existeDni) {
          return res.status(409).send("El DNI ya está registrado");
        }
      }

      const sqlUsuario = "INSERT INTO usuarios (email, contraseña, id_rol) VALUES (?, ?, ?)";
      return db.query(sqlUsuario, [email, passHash, id_rol])
        .then(([resultUsuario]) => {
          const id_usuario = resultUsuario.insertId;

          const sqlDireccion = "INSERT INTO direcciones (calle, numero, piso, departamento) VALUES (?, ?, ?, ?)";
          return db.query(sqlDireccion, [calle, numero, piso, departamento])
            .then(([resultDireccion]) => {
              const id_direccion = resultDireccion.insertId;

              const sqlPersona = "INSERT INTO personas (nombre, apellido, dni, telefono, id_direccion, id_usuario) VALUES (?, ?, ?, ?, ?, ?)";
              return db.query(sqlPersona, [nombre, apellido, dni, telefono, id_direccion, id_usuario]);
            });
        })
        .then(() => {
          res.status(201).send("Usuario, dirección y persona guardados correctamente");
        });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("Ocurrió un error al guardar los datos");
    });
});
//el cliente logueado puede editar su perfil
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

    // 2. Verificar duplicados de email y dni
    const sqlCheck = `
      SELECT u.id_usuario, u.email, p.dni
      FROM usuarios u
      LEFT JOIN personas p ON u.id_usuario = p.id_usuario
      WHERE (u.email = ? OR p.dni = ?) AND u.id_usuario <> ?
    `;
    const [rows] = await db.query(sqlCheck, [email, dni, id_usuario]);

    if (rows.length > 0) {
      const existeEmail = rows.some(r => r.email === email);
      const existeDni = rows.some(r => r.dni === dni);

      if (existeEmail) {
        return res.status(409).send("El email ya está registrado por otro usuario");
      }
      if (existeDni) {
        return res.status(409).send("El DNI ya está registrado por otro usuario");
      }
    }

    const sqlUpdatePersona = `
      UPDATE personas
      SET nombre = ?, apellido = ?, dni = ?, telefono = ?
      WHERE id_persona = ?
    `;
    await db.query(sqlUpdatePersona, [nombre, apellido, dni, telefono, id_persona]);

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

    // 5. Actualizar dirección
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