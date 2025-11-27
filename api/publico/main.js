const router = require("express").Router();
const db = require('../../conexion');

router.get("/servicios", function(req, res) {
  const pagina = parseInt(req.query.pagina) || 1;
  const registrosPorPagina = 6;
  const offset = (pagina - 1) * registrosPorPagina;

  const sqlDatos = `
    SELECT id_servicio, nombre, precio
    FROM servicios WHERE estado = 1
    LIMIT ? OFFSET ?
  `;

  const sqlCount = `
    SELECT COUNT(*) AS total 
    FROM servicios
  `;

  // Ejecutar ambas consultas en paralelo
  Promise.all([
    db.query(sqlDatos, [registrosPorPagina, offset]),
    db.query(sqlCount)
  ])
    .then(([[datos], [conteo]]) => {
      const totalRegistros = conteo[0].total;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

      res.send({
        paginaActual: pagina,
        registrosPorPagina,
        totalRegistros,
        totalPaginas,
        servicios: datos
      });
    })
    .catch((error) => {
      console.error("Error en GET /servicios:", error);
      res.status(500).send("Ocurrió un error al obtener las servicios");
    });
});

router.get("/veterinarios", function(req, res) {
  const pagina = parseInt(req.query.pagina) || 1;
  const registrosPorPagina = 3;
  const offset = (pagina - 1) * registrosPorPagina;

  const sqlDatos = `
    SELECT 
      v.id_veterinario,
      p.nombre AS nombre_veterinario,
      p.apellido AS apellido_veterinario,
      e.nombre AS especialidad
    FROM veterinarios v
    INNER JOIN personas p ON v.id_persona = p.id_persona
    INNER JOIN especialidades e ON v.id_especialidad = e.id_especialidad
    LIMIT ? OFFSET ?
  `;

  const sqlCount = `
    SELECT COUNT(*) AS total 
    FROM veterinarios
  `;

  Promise.all([
    db.query(sqlDatos, [registrosPorPagina, offset]),
    db.query(sqlCount)
  ])
    .then(([[datos], [conteo]]) => {
      const totalRegistros = conteo[0].total;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

      res.send({
        paginaActual: pagina,
        registrosPorPagina,
        totalRegistros,
        totalPaginas,
        veterinarios: datos
      });
    })
    .catch((error) => {
      console.error("Error en GET /veterinarios:", error);
      res.status(500).send("Ocurrió un error al obtener los veterinarios");
    });
});




module.exports = router;