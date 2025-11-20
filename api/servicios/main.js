const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

router.get("/", function(req, res) {
  const pagina = parseInt(req.query.pagina) || 1;
  const registrosPorPagina = 4;
  const offset = (pagina - 1) * registrosPorPagina;
  const sqlDatos = "SELECT * FROM servicios LIMIT ? OFFSET ?";
  const sqlTotal = "SELECT COUNT(*) AS total FROM servicios";

  // Primero obtengo los registros de la página
  db.query(sqlDatos, [registrosPorPagina, offset])
    .then(([rows]) => {

      // Ahora consulto el total de registros
      db.query(sqlTotal)
        .then(([totalRows]) => {
          const totalRegistros = totalRows[0].total;
          const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

          // RESPUESTA FINAL QUE EL FRONT NECESITA
          res.send({
            paginaActual: pagina,
            totalPaginas: totalPaginas,
            data: rows,
          });
        })
        .catch((error) => {
          console.error("Error en COUNT:", error);
          res.status(500).send("Error al contar registros");
        });
    })
    .catch((error) => {
      console.error("Error al obtener servicios paginados:", error);
      res.status(500).send("Error al obtener servicios");
    });
});

router.get("/select", auth, verificarRol(2,3), function(req, res, next) {
  const sql = "SELECT * FROM servicios";
  db.query(sql)
    .then(([rows]) => {
      res.send(rows);
    })
    .catch((error) => {
      console.error("Error en GET /servicios/ver:", error);
      res.status(500).send("Ocurrió un error al obtener los servicios");
    });
});

//el admin crea un servicio
router.post("/crearservicio", auth, verificarRol(1), function(req, res, next) {
  const { nombre, precio } = req.body;

  //el estado es "activo" cuando se lo crea.
  const estado = 1;
  const sql = "INSERT INTO servicios (nombre, estado, precio) VALUES (?, ?, ?)";

  db.query(sql, [nombre, estado, precio])
    .then(([result]) => {
      res.status(201).send("Servicio creado correctamente");
    })
    .catch((error) => {
      console.error("Error en POST /crearservicio:", error);
      res.status(500).send("Ocurrió un error al crear el servicio");
    });
});

//el admin cambia el servicio
router.put("/modificarservicio/:id", auth, verificarRol(1), function(req, res, next) {
  const { id } = req.params;
  const { nombre, precio} = req.body;
  const estado = 1;
//modificar todo
  const sql = "UPDATE servicios SET nombre = ?, precio = ?, estado = ? WHERE id_servicio = ?";

  db.query(sql, [nombre, precio, estado, id])
    .then(([result]) => {
      if (result.affectedRows === 0) {
        res.status(404).send("Servicio no encontrado");
      } else {
        res.send("Estado del servicio actualizado correctamente");
      }
    })
    .catch((error) => {
      console.error("Error en PUT /modificar-estado:", error);
      res.status(500).send("Ocurrió un error al actualizar el estado");
    });
});

router.put("/modificarestado/:id", function(req, res, next) {
  const { id } = req.params;
  const { estado } = req.body;

  const sql = "UPDATE servicios SET estado = ? WHERE id_servicio = ?";

  db.query(sql, [estado, id])
    .then(([result]) => {
      if (result.affectedRows === 0) {
        res.status(404).send("Servicio no encontrado");
      } else {
        res.send("Estado del servicio actualizado correctamente");
      }
    })
    .catch((error) => {
      console.error("Error en PUT /modificarestado:", error);
      res.status(500).send("Ocurrió un error al actualizar el estado");
    });
});

module.exports = router;