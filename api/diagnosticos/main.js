const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");

//el veterinario ve los diagnosticos de una mascota
router.get("/", auth, verificarRol(2), async function(req, res) {
  const { id_mascota, pagina } = req.query;

  if (!id_mascota) {
    return res.status(400).send("El parámetro 'id_mascota' es obligatorio");
  }

  const registrosPorPagina = 1;
  const paginaActual = parseInt(pagina) || 1;
  const offset = (paginaActual - 1) * registrosPorPagina;

  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM diagnosticos d
    INNER JOIN turnos t ON d.id_turno = t.id_turno
    WHERE t.id_mascota = ?
  `;

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

  try {
    const [[conteo], [diagnosticos]] = await Promise.all([
      db.query(sqlCount, [id_mascota]),
      db.query(sqlDiagnosticos, [id_mascota, registrosPorPagina, offset])
    ]);

    const totalRegistros = conteo[0].total;
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

    for (let diag of diagnosticos) {
      const [archivos] = await db.query(
        "SELECT id_archivo, nombre FROM archivos WHERE id_diagnostico = ?",
        [diag.id_diagnostico]
      );
      diag.archivos = archivos;
    }

    res.send({
      paginaActual,
      registrosPorPagina,
      totalRegistros,
      totalPaginas,
      diagnosticos
    });
  } catch (error) {
    console.error("Error en GET /diagnosticos:", error);
    res.status(500).send("Ocurrió un error al obtener los diagnósticos");
  }
});
//el cliente puede ver el diagnostico y tratamiento
router.get("/turnocliente", auth, verificarRol(3), function(req, res) {
  const { id_turno } = req.query;

  if (!id_turno) {
    return res.status(400).send("Falta el parámetro id_turno");
  }

  const sql = `
    SELECT 
      d.id_diagnostico,
      d.id_turno,
      d.diagnostico,
      d.tratamiento
    FROM diagnosticos d
    WHERE d.id_turno = ?
    LIMIT 1
  `;
//archu
  db.query(sql, [id_turno])
    .then(([rows]) => {
      if (rows.length === 0) {
        return res.status(200).json({ diagnostico: null });
      }
      res.status(200).json({ diagnostico: rows[0] });
    })
    .catch((error) => {
      console.error("Error en GET /turnocliente:", error);
      res.status(500).send("Ocurrió un error al obtener el diagnóstico");
    });
});
//el veterinario ve los diagnosticos dependiendo del turno
router.get("/turno", auth, verificarRol(2), function(req, res) {
  const { id_turno } = req.query;

  if (!id_turno) {
    return res.status(400).send("Falta el parámetro id_turno");
  }

  const sql = `
    SELECT 
      d.id_diagnostico,
      d.id_turno,
      d.diagnostico,
      d.tratamiento,
      d.observaciones,
      d.peso_actual
    FROM diagnosticos d
    WHERE d.id_turno = ?
    LIMIT 1
  `;

  db.query(sql, [id_turno])
    .then(([rows]) => {
      if (rows.length === 0) {
        return res.status(200).json({ diagnostico: null });
      }
      res.status(200).json({ diagnostico: rows[0] });
    })
    .catch((error) => {
      console.error("Error en GET /turno:", error);
      res.status(500).send("Ocurrió un error al obtener el diagnóstico");
    });
});
//el veterinario crea un nuevo diagnostico, dependiendo del turno y actualiza el peso
router.post("/", auth, verificarRol(2), async function(req, res) {
  const {
    id_turno,
    diagnostico,
    tratamiento,
    observaciones,
    peso_actual
  } = req.body;

  try {
    const sqlDiagnostico = `
      INSERT INTO diagnosticos (id_turno, diagnostico, tratamiento, observaciones, peso_actual)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sqlDiagnostico, [
      id_turno,
      diagnostico,
      tratamiento,
      observaciones,
      peso_actual
    ]);

    const id_diagnostico = result.insertId;

    const sqlActualizarPeso = `
      UPDATE mascotas m
      JOIN turnos t ON m.id_mascota = t.id_mascota
      SET m.peso = ?
      WHERE t.id_turno = ?
    `;
    await db.query(sqlActualizarPeso, [peso_actual, id_turno]);

    const [rows] = await db.query(
      "SELECT * FROM diagnosticos WHERE id_diagnostico = ?",
      [id_diagnostico]
    );

    res.status(201).json({ diagnostico: rows[0] });
  } catch (error) {
    console.error("Error al registrar diagnóstico:", error);
    res.status(500).send("Ocurrió un error al registrar el diagnóstico");
  }
});
//el veterinario modifica ciertos campos del diagnostico
router.put("/:id_diagnostico", auth, verificarRol(2), async function(req, res) {
  const { id_diagnostico } = req.params;
  const { diagnostico, tratamiento, observaciones, peso_actual } = req.body;

  try {
    const sqlUpdate = `
      UPDATE diagnosticos
      SET diagnostico = ?, tratamiento = ?, observaciones = ?, peso_actual = ?
      WHERE id_diagnostico = ?
    `;
    await db.query(sqlUpdate, [
      diagnostico,
      tratamiento,
      observaciones,
      peso_actual,
      id_diagnostico
    ]);

    // 2. Obtener el turno y la mascota asociada a este diagnóstico
    const [turnoRows] = await db.query(
      `SELECT d.id_turno, t.id_mascota, t.fecha
       FROM diagnosticos d
       INNER JOIN turnos t ON d.id_turno = t.id_turno
       WHERE d.id_diagnostico = ?`,
      [id_diagnostico]
    );

    if (turnoRows.length > 0) {
      const { id_turno, id_mascota, fecha } = turnoRows[0];

      // 3. Verificar si este diagnóstico es el último registrado para esa mascota
      const [ultimoDiagRows] = await db.query(
        `SELECT d.id_diagnostico
         FROM diagnosticos d
         INNER JOIN turnos t ON d.id_turno = t.id_turno
         WHERE t.id_mascota = ?
         ORDER BY t.fecha DESC, d.id_diagnostico DESC
         LIMIT 1`,
        [id_mascota]
      );

      if (ultimoDiagRows.length > 0 && ultimoDiagRows[0].id_diagnostico == id_diagnostico) {
        const sqlActualizarPeso = `
          UPDATE mascotas
          SET peso = ?
          WHERE id_mascota = ?
        `;
        await db.query(sqlActualizarPeso, [peso_actual, id_mascota]);
      }
    }

    const [rows] = await db.query(
      "SELECT * FROM diagnosticos WHERE id_diagnostico = ?",
      [id_diagnostico]
    );

    res.status(200).json({ diagnostico: rows[0] });
  } catch (error) {
    console.error("Error al actualizar diagnóstico:", error);
    res.status(500).send("Ocurrió un error al actualizar el diagnóstico");
  }
});

module.exports = router;