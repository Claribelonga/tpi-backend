const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

const {hashPass} = require('@damianegreco/hashpass');

//El admin puede ver una lista de clientes con paginacion.
router.get("/", function(req, res) {
  const { pagina, busqueda } = req.query;

  const registrosPorPagina = 4;
  const paginaActual = parseInt(pagina) || 1;
  const offset = (paginaActual - 1) * registrosPorPagina; //cual fue la ultimo registro 

  const filtros = [];
  const params = [];
  const countParams = [];

  let where = "WHERE u.id_rol = 3";

  if (busqueda) {
    where += " AND CONCAT(p.nombre, ' ', p.apellido) LIKE ?";
    filtros.push(`%${busqueda}%`);
  }

  // 1. Obtener total de personas
  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM personas p
    INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
    ${where}
  `;

  // 2. Obtener los id_persona paginados
  const sqlIds = `
    SELECT p.id_persona
    FROM personas p
    INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
    ${where}
    ORDER BY p.id_persona
    LIMIT ? OFFSET ?
  `;

  // 3. Luego traer los datos completos con JOINs
  Promise.all([
    db.query(sqlCount, filtros),
    db.query(sqlIds, [...filtros, registrosPorPagina, offset])
  ])
    .then(([[conteo], [ids]]) => {
      const totalRegistros = conteo[0].total;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

      if (!ids.length) {
        return res.send({
          paginaActual,
          registrosPorPagina,
          totalRegistros,
          totalPaginas,
          personas: []
        });
      }

      const idList = ids.map(p => p.id_persona);
      const placeholders = idList.map(() => "?").join(",");

      const sqlFinal = `
        SELECT 
          p.id_persona, p.nombre, p.apellido, p.dni, p.telefono,
          d.id_direccion, d.calle, d.numero, d.piso, d.departamento,
          u.id_usuario, u.email,
          m.id_mascota, m.nombre AS nombre_mascota
        FROM personas p
        INNER JOIN direcciones d ON p.id_direccion = d.id_direccion
        INNER JOIN usuarios u ON p.id_usuario = u.id_usuario
        LEFT JOIN mascotas m ON p.id_persona = m.id_persona
        WHERE p.id_persona IN (${placeholders})
        ORDER BY p.id_persona
      `;

      return db.query(sqlFinal, idList).then(([rows]) => {
        const personasMap = {};

        rows.forEach(row => {
          const id = row.id_persona;

          if (!personasMap[id]) {
            personasMap[id] = {
              id_persona: id,
              nombre: row.nombre,
              apellido: row.apellido,
              dni: row.dni,
              telefono: row.telefono,
              direccion: {
                id_direccion: row.id_direccion,
                calle: row.calle,
                numero: row.numero,
                piso: row.piso,
                departamento: row.departamento
              },
              usuario: {
                id_usuario: row.id_usuario,
                email: row.email
              },
              mascotas: []
            };
          }

          if (row.id_mascota) {
            personasMap[id].mascotas.push({
              id_mascota: row.id_mascota,
              nombre: row.nombre_mascota
            });
          }
        });

        res.send({
          paginaActual,
          registrosPorPagina,
          totalRegistros,
          totalPaginas,
          personas: Object.values(personasMap)
        });
      });
    })
    .catch(error => {
      console.error("Error en GET /personas:", error);
      res.status(500).send("Ocurrió un error al obtener los datos");
    });
});
// El admin crea un nuevo cliente
router.post("/crearcliente", async function(req, res, next) {
  const {
    email, nombre, apellido, dni, telefono,
    calle, numero, piso, departamento
  } = req.body;

  const passHash = hashPass(dni.toString());
  const id_rol = 3;

  try {
    const sqlCheck = `
      SELECT u.email, p.dni
      FROM usuarios u
      LEFT JOIN personas p ON u.id_usuario = p.id_usuario
      WHERE u.email = ? OR p.dni = ?
    `;
    const [rows] = await db.query(sqlCheck, [email, dni]);

    const errores = [];
    if (rows.length > 0) {
      if (rows.some(r => r.email === email)) errores.push("El email ya está registrado");
      if (rows.some(r => r.dni === dni)) errores.push("El DNI ya está registrado");
    }

    if (errores.length > 0) {
      return res.status(409).json({ errores });
    }

    const sqlUsuario = "INSERT INTO usuarios (email, contraseña, id_rol) VALUES (?, ?, ?)";
    const [resultUsuario] = await db.query(sqlUsuario, [email, passHash, id_rol]);
    const id_usuario = resultUsuario.insertId;

    const sqlDireccion = "INSERT INTO direcciones (calle, numero, piso, departamento) VALUES (?, ?, ?, ?)";
    const [resultDireccion] = await db.query(sqlDireccion, [calle, numero, piso, departamento]);
    const id_direccion = resultDireccion.insertId;

    const sqlPersona = "INSERT INTO personas (nombre, apellido, dni, telefono, id_direccion, id_usuario) VALUES (?, ?, ?, ?, ?, ?)";
    await db.query(sqlPersona, [nombre, apellido, dni, telefono, id_direccion, id_usuario]);

    res.status(201).send("Usuario, dirección y persona guardados correctamente");
  } catch (error) {
    console.error("Error al crear cliente:", error);

    if (error.code === "ER_DUP_ENTRY") {
      const errores = [];
      if (error.sqlMessage.includes("dni")) errores.push("El DNI ya está registrado");
      if (error.sqlMessage.includes("email")) errores.push("El email ya está registrado");
      return res.status(409).json({ errores });
    }

    res.status(500).send("Ocurrió un error al guardar los datos");
  }
});
// el admin edita al cliente, menos mascotas y contra
router.put("/editarcliente/:id_usuario", async function(req, res, next) {
  const { id_usuario } = req.params;
  const {
    email,
    nombre, apellido, dni, telefono,
    calle, numero, piso, departamento
  } = req.body;

  try {
    // 0. Verificar duplicados de email y dni en otros usuarios
    const sqlCheck = `
      SELECT u.email, p.dni
      FROM usuarios u
      LEFT JOIN personas p ON u.id_usuario = p.id_usuario
      WHERE (u.email = ? OR p.dni = ?) AND u.id_usuario <> ?
    `;
    const [rows] = await db.query(sqlCheck, [email, dni, id_usuario]);

    const errores = [];
    if (rows.length > 0) {
      if (rows.some(r => r.email === email)) errores.push("El email ya está registrado por otro usuario");
      if (rows.some(r => r.dni === dni)) errores.push("El DNI ya está registrado por otro usuario");
    }

    if (errores.length > 0) {
      return res.status(409).json({ errores });
    }

    const sqlUsuario = "UPDATE usuarios SET email = ? WHERE id_usuario = ?";
    await db.query(sqlUsuario, [email, id_usuario]);

    const sqlPersona = "UPDATE personas SET nombre = ?, apellido = ?, dni = ?, telefono = ? WHERE id_usuario = ?";
    await db.query(sqlPersona, [nombre, apellido, dni, telefono, id_usuario]);

    const sqlGetDireccion = "SELECT id_direccion FROM personas WHERE id_usuario = ?";
    const [rowsDireccion] = await db.query(sqlGetDireccion, [id_usuario]);

    if (rowsDireccion.length === 0) throw new Error("No se encontró la persona asociada al usuario");

    const id_direccion = rowsDireccion[0].id_direccion;

    const sqlDireccion = "UPDATE direcciones SET calle = ?, numero = ?, piso = ?, departamento = ? WHERE id_direccion = ?";
    await db.query(sqlDireccion, [calle, numero, piso, departamento, id_direccion]);

    res.status(200).send("Perfil completo actualizado correctamente");
  } catch (error) {
    console.error("Error al actualizar perfil completo:", error);

    if (error.code === "ER_DUP_ENTRY") {
      const errores = [];
      if (error.sqlMessage.includes("dni")) errores.push("El DNI ya está registrado por otro usuario");
      if (error.sqlMessage.includes("email")) errores.push("El email ya está registrado por otro usuario");
      return res.status(409).json({ errores });
    }

    res.status(500).send("Ocurrió un error al actualizar el perfil");
  }
});
//restablecer contrasena, para clientes y veterinarios, solo admin
router.put("/restablecer/:id_usuario", async function(req, res) {
  const { id_usuario } = req.params;

  try {
    const [personas] = await db.query(
      "SELECT dni FROM personas WHERE id_usuario = ?",
      [id_usuario]
    );

    if (!personas.length) {
      return res.status(404).send("No se encontró persona asociada al usuario");
    }

    const dni = personas[0].dni;

    const hashedPassword = hashPass(dni.toString());

    const [result] = await db.query(
      "UPDATE usuarios SET contraseña = ? WHERE id_usuario = ?",
      [hashedPassword, id_usuario]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Usuario no encontrado");
    }

    res.status(200).send("Contraseña restablecida correctamente (DNI como nueva contraseña)");

  } catch (error) {
    console.error("Error en PUT /restablecer:", error);
    res.status(500).send("Ocurrió un error al restablecer la contraseña");
  }
});

module.exports = router;