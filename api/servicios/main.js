const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

router.get("/", function(req, res, next) {
  const { pagina } = req.query;

  const registrosPorPagina = 4;
  const paginaActual = parseInt(pagina) || 2;
  const offset = (paginaActual - 1) * registrosPorPagina;

  const sql = "SELECT * FROM servicios LIMIT ? OFFSET ?";

  db.query(sql, [registrosPorPagina, offset])
    .then(([rows]) => {
      res.send(rows);
    })
    .catch((error) => {
      console.error("Error en GET /servicios/ver paginado:", error);
      res.status(500).send("Ocurrió un error al obtener los servicios");
    });
});


router.get("/select", function(req, res, next) {
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
router.post("/crearservicio", function(req, res, next) {
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
router.put("/modificarservicio/:id", function(req, res, next) {
  const { id } = req.params;
  const { nombre, precio, estado } = req.body;
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




module.exports = router;