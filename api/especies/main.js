const router = require("express").Router();
const db = require('../../conexion');

//el cliente tiene un select con todas las especies disponibles
router.get("/", function(req, res, next) {
  const sql = "SELECT * FROM especies";

  db.query(sql)
    .then(([rows]) => {
      res.send(rows);
    })
    .catch((error) => {
      console.error("Error en GET /select/ver:", error);
      res.status(500).send("Ocurrió un error al obtener las especies");
    });
});

//Dependiendo la especie que se seleccione, el cliente puede ver las razas disponibles
router.get("/razas", function(req, res, next) {
  const {id_especie} = req.query;

  // Validación: id_especies es obligatorio
  if (!id_especie) {
    return res.status(400).send("El parámetro 'id_especie' es requerido");
  }

  const sql = "SELECT * FROM razas WHERE id_especie = ? ";

  db.query(sql, [id_especie])
    .then(([rows]) => {
      res.send(rows);
    })
    .catch((error) => {
      console.error("Error en GET /raza:", error);
      res.status(500).send("Ocurrió un error al obtener las razas");
    });
});


module.exports = router;