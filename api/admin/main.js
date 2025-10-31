const router = require("express").Router();
const db = require('../../conexion');

const {hashPass} = require('@damianegreco/hashpass');

//un get con paginacion para ver la lista de clientes, preguntar si es la mejor opcion
router.get("/ver", function(req, res, next) {
  const { pagina, busqueda } = req.query;

  res.send ("ruta de admin andando");

  const registrosPorPagina = 4;
  const paginaActual = parseInt(pagina) || 1;
  const offset = (paginaActual - 1) * registrosPorPagina;

  let sqlPersonas = `
    SELECT 
      p.id_persona, p.nombre, p.apellido, p.dni, p.telefono, p.id_direccion, p.id_usuario,
      d.calle, d.numero, d.piso, d.departamento,
      u.email
    FROM personas p
    JOIN direcciones d ON p.id_direccion = d.id_direccion
    JOIN usuarios u ON p.id_usuario = u.id_usuario
    WHERE u.id_rol = 3
  `;

  const params = [];

  // Búsqueda parcial por nombre y apellido
  if (busqueda) {
    sqlPersonas += " AND CONCAT(p.nombre, ' ', p.apellido) LIKE ?";
    params.push(`%${busqueda}%`);
  }

  sqlPersonas += " LIMIT ? OFFSET ?";
  params.push(registrosPorPagina, offset);

  db.query(sqlPersonas, params)
    .then(([personas]) => {
      const ids = personas.map(p => p.id_persona);
      if (ids.length === 0) return res.send([]);

      const sqlMascotas = `
        SELECT id_mascota, nombre, id_persona
        FROM mascotas
        WHERE id_persona IN (${ids.map(() => '?').join(',')})
      `;

      db.query(sqlMascotas, ids)
        .then(([mascotas]) => {
          const mascotasPorPersona = {};
          mascotas.forEach(m => {
            if (!mascotasPorPersona[m.id_persona]) {
              mascotasPorPersona[m.id_persona] = [];
            }
            mascotasPorPersona[m.id_persona].push({
              id_mascota: m.id_mascota,
              nombre: m.nombre
            });
          });
          //preguntar si esta bien
          const resultadoFinal = personas.map(p => ({
            id_persona: p.id_persona,
            nombre: p.nombre,
            apellido: p.apellido,
            dni: p.dni,
            telefono: p.telefono,
            direccion: {
              id_direccion: p.id_direccion,
              calle: p.calle,
              numero: p.numero,
              piso: p.piso,
              departamento: p.departamento
            },
            usuario: {
              id_usuario: p.id_usuario,
              email: p.email
            },
            mascotas: mascotasPorPersona[p.id_persona] || []
          }));

          res.send(resultadoFinal);
        })
        .catch(error => {
          console.error("Error al obtener mascotas:", error);
          res.status(500).send("Ocurrió un error al obtener las mascotas");
        });
    })
    .catch(error => {
      console.error("Error en GET /personas:", error);
      res.status(500).send("Ocurrió un error al obtener las personas");
    });
});



//crea un nuevo cliente
router.post("/crearcliente", function(req, res, next) {
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

//editar el cliente, menos mascotas ya que corresponde a otra tabla
router.put("/editarcliente/:id_usuario", function(req, res, next) {
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