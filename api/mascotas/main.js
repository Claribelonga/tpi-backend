const router = require("express").Router();
const db = require('../../conexion');
const { auth } = require('../middleware'); // Middleware de autenticación

//me trae un listado de mascotas segun el cliente que se logeo
router.get("/", auth, function(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).send("Usuario no identificado");
  }

  const sqlPersona = `
    SELECT id_persona 
    FROM personas 
    WHERE id_usuario = ?
  `;

  db.query(sqlPersona, [userId])
    .then(([personas]) => {
      if (!personas.length) {
        return res.send({ mascotas: [] });
      }

      const idPersona = personas[0].id_persona;

      const sqlMascotas = `
        SELECT 
          m.id_mascota,
          m.nombre,
          m.sexo,
          m.fecha_nacimiento,
          m.altura,
          m.peso,
          r.id_raza,
          r.nombre AS nombre_raza
        FROM mascotas m
        INNER JOIN razas r ON m.id_raza = r.id_raza
        WHERE m.id_persona = ?
      `;

      db.query(sqlMascotas, [idPersona])
        .then(([mascotas]) => {
          res.send({ mascotas });
        })
        .catch(error => {
          console.error("Error al obtener mascotas:", error);
          res.status(500).send("Ocurrió un error al obtener las mascotas");
        });
    })
    .catch(error => {
      console.error("Error al obtener persona:", error);
      res.status(500).send("Ocurrió un error al identificar al usuario");
    });
});
//al guardar la nueva mascota usa el id del cliente logueado y lo crea.
router.post("/nuevamascota", auth, function(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).send("Usuario no autenticado");
  }

  const {
    nombre,
    id_raza,
    sexo,
    fecha_nacimiento,
    altura,
    peso
  } = req.body;

  // 1. Obtener el id_persona del usuario
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

      // 2. Insertar la nueva mascota
      const sqlInsertMascota = `
        INSERT INTO mascotas (
          nombre, id_raza, sexo, fecha_nacimiento, altura, peso, id_persona
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        nombre,
        id_raza,
        sexo,
        fecha_nacimiento,
        altura,
        peso,
        id_persona
      ];

      return db.query(sqlInsertMascota, values);
    })
    .then(() => {
      res.status(201).send("Mascota registrada correctamente");
    })
    .catch(error => {
      console.error("Error al registrar mascota:", error);
      res.status(500).send("Ocurrió un error al registrar la mascota");
    });
});

router.put("/mascotas/:id_mascota", auth, function(req, res) {
  const userId = req.user?.id;
  const { id_mascota } = req.params;

  const {
    nombre,
    id_raza,
    sexo,
    fecha_nacimiento,
    altura,
    peso
  } = req.body;

  if (!userId) {
    return res.status(401).send("Usuario no autenticado");
  }

  // 1. Obtener id_persona del usuario
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

      // 2. Verificar que la mascota pertenezca a ese id_persona
      const sqlVerificar = `
        SELECT id_mascota 
        FROM mascotas 
        WHERE id_mascota = ? AND id_persona = ?
      `;

      return db.query(sqlVerificar, [id_mascota, id_persona])
        .then(([mascotas]) => {
          if (!mascotas.length) {
            throw new Error("No tenés permiso para editar esta mascota");
          }

          // 3. Actualizar la mascota
          const sqlUpdate = `
            UPDATE mascotas 
            SET nombre = ?, id_raza = ?, sexo = ?, fecha_nacimiento = ?, altura = ?, peso = ?
            WHERE id_mascota = ?
          `;

          const values = [nombre, id_raza, sexo, fecha_nacimiento, altura, peso, id_mascota];
          return db.query(sqlUpdate, values);
        });
    })
    .then(() => {
      res.status(200).send("Mascota actualizada correctamente");
    })
    .catch(error => {
      console.error("Error al actualizar mascota:", error);
      res.status(500).send(error.message || "Ocurrió un error al actualizar la mascota");
    });
});


module.exports = router;



module.exports = router;