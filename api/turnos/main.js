const express = require('express');
const router = express.Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

//veo los turnos de todos los animales segun el cliente logeado y un filtro 
router.get("/cliente", auth, verificarRol(3), function(req, res) {
  const userId = req.user?.id;
  const { id_mascota } = req.query;

  if (!userId) {
    return res.status(401).send("Usuario no autenticado");
  }

  const sqlPersona = `
    SELECT id_persona 
    FROM personas 
    WHERE id_usuario = ?
  `;

  db.query(sqlPersona, [userId])
    .then(([personas]) => {
      if (!personas.length) {
        return res.status(404).send("No se encontró la persona asociada al usuario");
      }

      const id_persona = personas[0].id_persona;

      // Consulta enriquecida con JOINs
      let sqlTurnos = `
        SELECT 
          t.id_turno, t.fecha, t.hora, t.estado,
          t.id_servicio, s.nombre AS nombre_servicio,
          t.id_mascota, m.nombre AS nombre_mascota,
          t.id_veterinario, pv.nombre AS nombre_veterinario, pv.apellido AS apellido_veterinario
        FROM turnos t
        INNER JOIN mascotas m ON t.id_mascota = m.id_mascota
        INNER JOIN servicios s ON t.id_servicio = s.id_servicio
        INNER JOIN veterinarios v ON t.id_veterinario = v.id_veterinario
        INNER JOIN personas pv ON v.id_persona = pv.id_persona
        WHERE m.id_persona = ?
      `;

      const params = [id_persona];

      if (id_mascota) {
        sqlTurnos += " AND m.id_mascota = ?";
        params.push(id_mascota);
      }

      sqlTurnos += " ORDER BY t.fecha DESC, t.hora DESC";

      return db.query(sqlTurnos, params);
    })
    .then(([turnos]) => {
      res.send({ turnos });
    })
    .catch(error => {
      console.error("Error al obtener turnos:", error);
      res.status(500).send("Ocurrió un error al obtener los turnos");
    });
});

//el vete que se logueo puede ver sus turnos asignados, no ve los cancelados
router.get("/veterinario", auth, verificarRol(2), async function(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).send("Usuario no autenticado");
  }

  try {
    // 1. Obtener id_persona del usuario
    const [personas] = await db.query(
      "SELECT id_persona FROM personas WHERE id_usuario = ?",
      [userId]
    );
    if (!personas.length) {
      throw new Error("No se encontró la persona asociada al usuario");
    }
    const id_persona = personas[0].id_persona;

    // 2. Obtener id_veterinario
    const [veterinarios] = await db.query(
      "SELECT id_veterinario FROM veterinarios WHERE id_persona = ?",
      [id_persona]
    );
    if (!veterinarios.length) {
      throw new Error("No sos un veterinario registrado");
    }
    const id_veterinario = veterinarios[0].id_veterinario;

    // 3. Armar filtros dinámicos
    const { servicio, fecha, estado } = req.query; 
    let sqlTurnos = `
      SELECT 
        t.id_turno, t.fecha, t.hora, t.estado,
        s.nombre AS nombre_servicio,
        m.id_mascota, m.nombre AS nombre_mascota
      FROM turnos t
      INNER JOIN servicios s ON t.id_servicio = s.id_servicio
      INNER JOIN mascotas m ON t.id_mascota = m.id_mascota
      INNER JOIN personas pc ON m.id_persona = pc.id_persona
      WHERE t.id_veterinario = ?
    `;
    const params = [id_veterinario];

    if (estado) {
      sqlTurnos += " AND t.estado = ?";
      params.push(estado);
    } else {
      // valor por defecto si no se pasa estado
      sqlTurnos += " AND t.estado IN ('pendiente','finalizado')";
    }

    if (servicio) {
      sqlTurnos += " AND s.nombre LIKE ?";
      params.push(`%${servicio}%`);
    }
    if (fecha) {
      sqlTurnos += " AND DATE(t.fecha) = ?";
      params.push(fecha);
    }

    sqlTurnos += " ORDER BY t.fecha ASC, t.hora ASC";

    // 4. Ejecutar consulta
    const [turnos] = await db.query(sqlTurnos, params);

    res.send({ turnos });

  } catch (error) {
    console.error("Error al obtener turnos del veterinario:", error);
    if (!res.headersSent) {
      res.status(500).send(error.message || "Ocurrió un error al obtener los turnos");
    }
  }
});
//obtengo los datos de la mascota y su dueno, dependiendo del id_mascota.
router.get("/fichadatos", auth, verificarRol(2), function(req, res) {
  const { id_mascota } = req.query;

  if (!id_mascota) {
    return res.status(400).send("Falta el parámetro id_mascota");
  }

  const sql = `
    SELECT 
      -- Datos del dueño
      p.id_persona AS dueno_id,
      p.nombre AS dueno_nombre,
      p.apellido AS dueno_apellido,
      p.dni AS dueno_dni,
      p.telefono AS dueno_telefono,

      -- Datos de la mascota
      m.id_mascota,
      m.nombre AS nombre_mascota,
      m.id_raza,
      r.nombre AS nombre_raza,
      e.nombre AS nombre_especie,
      m.sexo,
      m.fecha_nacimiento,
      m.altura,
      m.peso,
      m.id_persona AS id_dueno
    FROM mascotas m
    INNER JOIN personas p ON m.id_persona = p.id_persona
    INNER JOIN razas r ON m.id_raza = r.id_raza
    INNER JOIN especies e ON r.id_especie = e.id_especie
    WHERE m.id_mascota = ?
  `;

  db.query(sql, [id_mascota])
    .then(([result]) => {
      if (!result.length) {
        return res.status(404).send("No se encontró la mascota");
      }

      res.send({ ficha: result[0] });
    })
    .catch(error => {
      console.error("Error al obtener ficha de datos:", error);
      res.status(500).send("Ocurrió un error al obtener los datos");
    });
});

//se encarga de traer el proximo turno comparando la fecha del turno con el de la compu
router.get("/proximo", auth, verificarRol(3), async function(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).send("Usuario no autenticado");
  }

  try {
    // 1. Obtener id_persona del usuario
    const [personas] = await db.query("SELECT id_persona FROM personas WHERE id_usuario = ?", [userId]);
    if (!personas.length) {
      throw new Error("No se encontró la persona asociada al usuario");
    }

    const id_persona = personas[0].id_persona;

    // 2. Obtener el próximo turno de sus mascotas
    const sqlTurno = `
      SELECT 
        t.fecha,
        t.hora,
        m.nombre AS nombre_mascota
      FROM turnos t
      INNER JOIN mascotas m ON t.id_mascota = m.id_mascota
      WHERE m.id_persona = ?
        AND CONCAT(t.fecha, ' ', t.hora) > NOW()
      ORDER BY t.fecha ASC, t.hora ASC
      LIMIT 1

    `;

    const [turnos] = await db.query(sqlTurno, [id_persona]);

    if (!turnos.length) {
      return res.status(404).send("No hay turnos futuros registrados");
    }

    res.send({ turno: turnos[0] });

  } catch (error) {
    console.error("Error al obtener próximo turno:", error);
    if (!res.headersSent) {
      res.status(500).send(error.message || "Ocurrió un error al obtener el próximo turno");
    }
  }
});

router.post("/sacarturno", auth, verificarRol(3), function(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).send("Usuario no autenticado");
  }

  const {
    fecha,
    hora,
    estado,
    id_servicio,
    id_mascota,
    id_veterinario
  } = req.body;

  let id_persona;

  // 1. Obtener id_persona del usuario
  db.query("SELECT id_persona FROM personas WHERE id_usuario = ?", [userId])
    .then(([personas]) => {
      if (!personas.length) {
        throw new Error("No se encontró la persona asociada al usuario");
      }

      id_persona = personas[0].id_persona;

      // 2. Verificar que la mascota pertenece al cliente
      const sqlMascota = `
        SELECT id_mascota 
        FROM mascotas 
        WHERE id_mascota = ? AND id_persona = ?
      `;
      return db.query(sqlMascota, [id_mascota, id_persona]);
    })
    .then(([mascotas]) => {
      if (!mascotas.length) {
        throw new Error("No tenés permiso para sacar turno con esa mascota");
      }

      // 3. Insertar el turno
      const sqlInsert = `
        INSERT INTO turnos (
          fecha, hora, estado, id_servicio, id_mascota, id_veterinario
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      const values = [fecha, hora, estado, id_servicio, id_mascota, id_veterinario];
      return db.query(sqlInsert, values);
    })
    .then(() => {
      res.status(201).send("Turno registrado correctamente");
    })
    .catch(error => {
      console.error("Error al registrar turno:", error);
      res.status(500).send(error.message || "Ocurrió un error al registrar el turno");
    });
});
router.put("/modificarestado", auth, verificarRol(2), function(req, res) {
  const { id_turno, estado } = req.body;

  if (!id_turno || typeof estado === "undefined") {
    return res.status(400).send("Faltan datos: id_turno o estado");
  }

  const sql = "UPDATE turnos SET estado = ? WHERE id_turno = ?";

  db.query(sql, [estado, id_turno])
    .then(([result]) => {
      if (result.affectedRows === 0) {
        return res.status(404).send("Turno no encontrado");
      }
      res.status(200).send("Estado del turno actualizado correctamente");
    })
    .catch((error) => {
      console.error("Error en PUT /modificarestado:", error);
      res.status(500).send("Ocurrió un error al actualizar el estado del turno");
    });
});

router.put("/modificarestado", auth, verificarRol(2), function(req, res) {
  const { id_turno, estado } = req.body;

  if (!id_turno || typeof estado === "undefined") {
    return res.status(400).send("Faltan datos: id_turno o estado");
  }

  const sql = "UPDATE turnos SET estado = ? WHERE id_turno = ?";

  db.query(sql, [estado, id_turno])
    .then(([result]) => {
      if (result.affectedRows === 0) {
        return res.status(404).send("Turno no encontrado");
      }
      res.status(200).send("Estado del turno actualizado correctamente");
    })
    .catch((error) => {
      console.error("Error en PUT /modificarestado:", error);
      res.status(500).send("Ocurrió un error al actualizar el estado del turno");
    });
});

//veo los turnos segun el veterinario que se logeo
module.exports = router;

