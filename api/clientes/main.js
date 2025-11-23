const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

const {hashPass} = require('@damianegreco/hashpass');

//El admin puede ver una lista de clientes con paginacion.
router.get("/", function(req, res) {
  const { pagina, busqueda } = req.query;

  const registrosPorPagina = 4;
  const paginaActual = parseInt(pagina) || 1;
  const offset = (paginaActual - 1) * registrosPorPagina;

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
router.post("/crearcliente", function(req, res, next) {
  const {
    email, contraseña, nombre, apellido, dni, telefono,
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

// el admin edita al cliente, menos mascotas y contra ya que corresponde a otra tabla.
router.put("/editarcliente/:id_usuario", function(req, res, next) {
  const { id_usuario } = req.params;
  const {
    email,
    nombre, apellido, dni, telefono,
    calle, numero, piso, departamento
  } = req.body;

  // 1. Actualizar usuarios (email vacía)
  const sqlUsuario = "UPDATE usuarios SET email = ? WHERE id_usuario = ?";
  db.query(sqlUsuario, [email, id_usuario])
    .then(() => {
      // 2. Actualizar personas
      const sqlPersona = "UPDATE personas SET nombre = ?, apellido = ?, dni = ?, telefono = ? WHERE id_usuario = ?";
      return db.query(sqlPersona, [nombre, apellido, dni, telefono, id_usuario]);
    })
    .then(() => {
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
      res.status(200).send("Perfil completo actualizado (contraseña vaciada)");
    })
    .catch((error) => {
      console.error("Error al actualizar perfil completo:", error);
      res.status(500).send("Ocurrió un error al actualizar el perfil");
    });
});
//restablecer contrasena, para clientes y veterinarios, solo admin
router.put("/restablecer/:id_usuario", async function(req, res) {
  const { id_usuario } = req.params;

  try {
    // 1. Buscar el dni en la tabla personas
    const [personas] = await db.query(
      "SELECT dni FROM personas WHERE id_usuario = ?",
      [id_usuario]
    );

    if (!personas.length) {
      return res.status(404).send("No se encontró persona asociada al usuario");
    }

    const dni = personas[0].dni;

    // 2. Hashear el dni con tu librería
    const hashedPassword = hashPass(dni.toString());

    // 3. Actualizar la contraseña en la tabla usuarios
    const [result] = await db.query(
      "UPDATE usuarios SET contraseña = ? WHERE id_usuario = ?",
      [hashedPassword, id_usuario]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Usuario no encontrado");
    }

    // 4. Respuesta de éxito
    res.status(200).send("Contraseña restablecida correctamente (DNI como nueva contraseña)");

  } catch (error) {
    console.error("Error en PUT /restablecer:", error);
    res.status(500).send("Ocurrió un error al restablecer la contraseña");
  }
});


module.exports = router;