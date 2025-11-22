const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

const {hashPass} = require('@damianegreco/hashpass');

//El admin puede ver la lista de veterinarios con paginacion.
router.get("/", auth, verificarRol(1), function(req, res) {
  const { pagina, busqueda } = req.query;

  const registrosPorPagina = 4;
  const paginaActual = parseInt(pagina) || 1;
  const offset = (paginaActual - 1) * registrosPorPagina;

  const params = [];
  const countParams = [];

  let sqlPersonas = `
    SELECT 
      p.id_persona, p.nombre, p.apellido, p.dni, p.telefono, p.id_direccion, p.id_usuario,
      d.calle, d.numero, d.piso, d.departamento,
      u.email,
      v.id_veterinario, v.matricula, v.id_especialidad
    FROM personas p
    JOIN direcciones d ON p.id_direccion = d.id_direccion
    JOIN usuarios u ON p.id_usuario = u.id_usuario
    INNER JOIN veterinarios v ON p.id_persona = v.id_persona
    WHERE u.id_rol = 2
  `;

  let sqlCount = `
    SELECT COUNT(DISTINCT p.id_persona) AS total
    FROM personas p
    JOIN usuarios u ON p.id_usuario = u.id_usuario
    INNER JOIN veterinarios v ON p.id_persona = v.id_persona
    WHERE u.id_rol = 2
  `;

  if (busqueda) {
    sqlPersonas += " AND CONCAT(p.nombre, ' ', p.apellido) LIKE ?";
    sqlCount += " AND CONCAT(p.nombre, ' ', p.apellido) LIKE ?";
    params.push(`%${busqueda}%`);
    countParams.push(`%${busqueda}%`);
  }

  sqlPersonas += " LIMIT ? OFFSET ?";
  params.push(registrosPorPagina, offset);

  Promise.all([
    db.query(sqlPersonas, params),
    db.query(sqlCount, countParams)
  ])
    .then(([[personas], [conteo]]) => {
      const totalRegistros = conteo[0].total;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

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
        veterinario: {
          id_veterinario: p.id_veterinario,
          matricula: p.matricula,
          id_especialidad: p.id_especialidad
        }
      }));

      res.send({
        paginaActual,
        registrosPorPagina,
        totalRegistros,
        totalPaginas,
        veterinarios: resultadoFinal
      });
    })
    .catch(error => {
      console.error("Error en GET /veterinarios:", error);
      res.status(500).send("Ocurrió un error al obtener los veterinarios");
    });
});

router.get("/perfil", auth, verificarRol(2), function(req, res) {
  const id_usuario = req.user?.id;

  if (!id_usuario) {
    return res.status(401).send("Usuario no identificado");
  }

  const sql = `
      SELECT 
          -- Datos de usuario y persona
          u.id_usuario, u.email,
          p.id_persona, p.nombre, p.apellido, p.dni, p.telefono, p.id_direccion,
          d.calle, d.numero, d.piso, d.departamento,

          -- Datos del veterinario
          v.id_veterinario, v.matricula, v.id_especialidad,
          e.nombre AS nombre_especialidad
        FROM usuarios u
        JOIN personas p ON u.id_usuario = p.id_usuario
        JOIN direcciones d ON p.id_direccion = d.id_direccion
        JOIN veterinarios v ON p.id_persona = v.id_persona
        JOIN especialidades e ON v.id_especialidad = e.id_especialidad
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
//editar datos personales del veterinario, menos matricula y especialidad
router.put("/perfil", auth, verificarRol(2), async function(req, res) {
  const id_usuario = req.user?.id;
  if (!id_usuario) {
    return res.status(401).send("Usuario no identificado");
  }

  const {
    nombre,
    apellido,
    dni,
    telefono,
    email,
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

    // 3. Actualizar datos en tabla usuarios (email)
    const sqlUpdateUsuario = `
      UPDATE usuarios
      SET email = ?
      WHERE id_usuario = ?
    `;
    await db.query(sqlUpdateUsuario, [email, id_usuario]);

    // 4. Actualizar datos en tabla direcciones
    const sqlUpdateDireccion = `
      UPDATE direcciones
      SET calle = ?, numero = ?, piso = ?, departamento = ?
      WHERE id_direccion = ?
    `;
    await db.query(sqlUpdateDireccion, [calle, numero, piso, departamento, id_direccion]);

    res.status(200).send("Perfil actualizado correctamente");
  } catch (error) {
    console.error("Error en PUT /perfil:", error);
    res.status(500).send("Ocurrió un error al actualizar el perfil");
  }
});
//el admin crea un nuevo veterinario
router.post("/crearveterinario", auth, verificarRol(1), function(req, res, next) {
  const {
    email, contraseña, nombre, apellido, dni, telefono,
    calle, numero, piso, departamento,
    matricula, id_especialidad
  } = req.body;

  const passHash = hashPass(contraseña);
  const id_rol = 2;
  // 1. Insertar en usuarios
  const sqlUsuario = "INSERT INTO usuarios (email, contraseña, id_rol) VALUES (?, ?, ?)";
  db.query(sqlUsuario, [email, passHash, id_rol])
    .then(([resultUsuario]) => {
      const id_usuario = resultUsuario.insertId;

      // 2. Insertar en direcciones
      const sqlDireccion = "INSERT INTO direcciones (calle, numero, piso, departamento) VALUES (?, ?, ?, ?)";
      return db.query(sqlDireccion, [calle, numero, piso, departamento])
        .then(([resultDireccion]) => {
          const id_direccion = resultDireccion.insertId;

          // 3. Insertar en personas
          const sqlPersona = "INSERT INTO personas (nombre, apellido, dni, telefono, id_direccion, id_usuario) VALUES (?, ?, ?, ?, ?, ?)";
          return db.query(sqlPersona, [nombre, apellido, dni, telefono, id_direccion, id_usuario])
            .then(([resultPersona]) => {
              const id_persona = resultPersona.insertId;

              // 4. Insertar en veterinarios
              const sqlVeterinario = "INSERT INTO veterinarios (matricula, id_especialidad, id_persona) VALUES (?, ?, ?)";
              return db.query(sqlVeterinario, [matricula, id_especialidad, id_persona]);
            });
        });
    })
    .then(() => {
      res.status(201).send("Veterinario creado correctamente");
    })
    .catch((error) => {
      console.error("Error al crear veterinario:", error);
      res.status(500).send("Ocurrió un error al guardar el veterinario");
    });
});


//el admin editar el veterinario 
router.put("/editarvete/:id_usuario", auth, verificarRol(1), function(req, res, next) {
  const { id_usuario } = req.params;
  const {
    email, contraseña,
    nombre, apellido, dni, telefono,
    calle, numero, piso, departamento,
    matricula, id_especialidad
  } = req.body;

  const passHash = hashPass(contraseña);

  // 1. Actualizar usuarios
  const sqlUsuario = "UPDATE usuarios SET email = ?, contraseña = ? WHERE id_usuario = ?";
  db.query(sqlUsuario, [email, passHash, id_usuario])
    .then(() => {
      // 2. Actualizar personas
      const sqlPersona = "UPDATE personas SET nombre = ?, apellido = ?, dni = ?, telefono = ? WHERE id_usuario = ?";
      return db.query(sqlPersona, [nombre, apellido, dni, telefono, id_usuario]);
    })
    .then(() => {
      // 3. Obtener id_direccion e id_persona
      const sqlGetPersona = "SELECT id_direccion, id_persona FROM personas WHERE id_usuario = ?";
      return db.query(sqlGetPersona, [id_usuario]);
    })
    .then(([rows]) => {
      if (rows.length === 0) throw new Error("No se encontró la persona asociada al usuario");

      const { id_direccion, id_persona } = rows[0];

      // 4. Actualizar direcciones
      const sqlDireccion = "UPDATE direcciones SET calle = ?, numero = ?, piso = ?, departamento = ? WHERE id_direccion = ?";
      return db.query(sqlDireccion, [calle, numero, piso, departamento, id_direccion])
        .then(() => {
          // 5. Actualizar veterinarios directamente
          const sqlVeterinario = "UPDATE veterinarios SET matricula = ?, id_especialidad = ? WHERE id_persona = ?";
          return db.query(sqlVeterinario, [matricula, id_especialidad, id_persona]);
        });
    })
    .then(() => {
      res.status(200).send("Perfil de veterinario actualizado correctamente");
    })
    .catch((error) => {
      console.error("Error al actualizar perfil de veterinario:", error);
      res.status(500).send("Ocurrió un error al actualizar el perfil");
    });
});


module.exports = router;