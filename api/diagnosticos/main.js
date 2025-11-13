const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

//veo los diagnosticos de una mascota
router.get("/", function(req, res) {
  const { id_mascota, pagina } = req.query;

  if (!id_mascota) {
    return res.status(400).send("El parámetro 'id_mascota' es obligatorio");
  }

  const registrosPorPagina = 4;
  const paginaActual = parseInt(pagina) || 1;
  const offset = (paginaActual - 1) * registrosPorPagina;

  // 1. Total de diagnósticos
  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM diagnosticos d
    INNER JOIN turnos t ON d.id_turno = t.id_turno
    WHERE t.id_mascota = ?
  `;

  // 2. Diagnósticos paginados con fecha del turno
  const sqlDiagnosticos = `
    SELECT 
      d.id_diagnostico,
      d.id_turno,
      d.diagnostico,
      d.tratamiento,
      d.observaciones,
      d.peso_actual,
      t.fecha AS fecha_turno
    FROM diagnosticos d
    INNER JOIN turnos t ON d.id_turno = t.id_turno
    WHERE t.id_mascota = ?
    ORDER BY t.fecha DESC
    LIMIT ? OFFSET ?
  `;

  Promise.all([
    db.query(sqlCount, [id_mascota]),
    db.query(sqlDiagnosticos, [id_mascota, registrosPorPagina, offset])
  ])
    .then(([[conteo], [diagnosticos]]) => {
      const totalRegistros = conteo[0].total;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

      res.send({
        paginaActual,
        registrosPorPagina,
        totalRegistros,
        totalPaginas,
        diagnosticos
      });
    })
    .catch(error => {
      console.error("Error en GET /diagnosticos:", error);
      res.status(500).send("Ocurrió un error al obtener los diagnósticos");
    });
});

//crea un nuevo diagnostico, dependiendo del turno y actualiza el peso
router.post("/", auth, verificarRol(2), function(req, res) {
  const {
    id_turno,
    diagnostico,
    tratamiento,
    observaciones,
    peso_actual,
    archivo_nombre,
    archivo_ruta,
    fecha_subida
  } = req.body;

  // 1. Insertar diagnóstico con peso_actual
  const sqlDiagnostico = `
    INSERT INTO diagnosticos (id_turno, diagnostico, tratamiento, observaciones, peso_actual)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sqlDiagnostico, [id_turno, diagnostico, tratamiento, observaciones, peso_actual])
    .then(([result]) => {
      const id_diagnostico = result.insertId;
      const promesas = [];

      // 2. Insertar archivo si se envió
      if (archivo_nombre && archivo_ruta && fecha_subida) {
        const sqlArchivo = `
          INSERT INTO archivos (nombre, ruta, id_diagnostico, fecha_subida)
          VALUES (?, ?, ?, ?)
        `;
        promesas.push(
          db.query(sqlArchivo, [archivo_nombre, archivo_ruta, id_diagnostico, fecha_subida])
        );
      }

      // 3. Actualizar peso en mascotas usando el id_turno
      const sqlActualizarPeso = `
        UPDATE mascotas
        SET peso = ?
        WHERE id_mascota = (
          SELECT id_mascota FROM turnos WHERE id_turno = ?
        )
      `;
      promesas.push(db.query(sqlActualizarPeso, [peso_actual, id_turno]));

      return Promise.all(promesas);
    })
    .then(() => {
      res.status(201).send("Diagnóstico registrado y peso actualizado correctamente");
    })
    .catch((error) => {
      console.error("Error al registrar diagnóstico:", error);
      res.status(500).send("Ocurrió un error al registrar el diagnóstico");
    });
});

router.post("/", auth, verificarRol(2), (req, res) => {
  const { diagnostico, tratamiento, observaciones } = req.body;

  if (!diagnostico || !tratamiento) {
    return res.status(400).send("Faltan campos obligatorios: diagnostico y tratamiento");
  }

  const sql = `
    INSERT INTO diagnosticos (diagnostico, tratamiento, observaciones)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [diagnostico, tratamiento, observaciones || null])
    .then(() => {
      res.status(201).send("Diagnóstico registrado correctamente");
    })
    .catch((error) => {
      console.error("Error al registrar diagnóstico:", error);
      res.status(500).send("Ocurrió un error al registrar el diagnóstico");
    });
});

module.exports = router;