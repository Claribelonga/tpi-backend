const router = require("express").Router();
const db = require('../../conexion');


//esto iria en admin ya que se encarga de ver la lista de especialidades
router.get("/", function(req, res, next) {
  const pagina = parseInt(req.query.pagina) || 1;
  const registrosPorPagina = 7;
  const offset = (pagina - 1) * registrosPorPagina;

  const sql = "SELECT id_especialidad, nombre FROM especialidades LIMIT ? OFFSET ?";
 //offset lo manejo en front
  db.query(sql, [registrosPorPagina, offset])
    .then(([rows]) => {
     
      res.send(rows);
    })
    .catch((error) => {
      console.error("Error en GET /especialidades:", error);
      res.status(500).send("Ocurrió un error al obtener las especialidades");
    });
});

//preguntar que hago para el form
router.get("/select", function(req, res, next) {
  const sql = "SELECT * FROM especialidades";

  db.query(sql)
    .then(([rows]) => {
      res.send(rows);
    })
    .catch((error) => {
      console.error("Error en GET /select/ver:", error);
      res.status(500).send("Ocurrió un error al obtener los servicios");
    });
});


module.exports = router;
