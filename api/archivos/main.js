const router = require("express").Router();
const db = require('../../conexion');
const { auth, verificarRol } = require("../middleware");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

const directorio = path.join(__dirname, "..","..", "archivosCarpeta");

router.post("/", auth, verificarRol(2), fileUpload(), async (req, res) => {
  try {
    if (!req.files || !req.files.archivo) {
      return res.status(400).send("No hay archivo");
    }

    const { archivo } = req.files;
    const { id_diagnostico } = req.body; // 👈 el diagnóstico al que se asocia

    if (!id_diagnostico) {
      return res.status(400).send("Falta id_diagnostico");
    }

    // Generar nombre único
    const extension = path.extname(archivo.name);
    const baseName = path.basename(archivo.name, extension);
    const nombreUnico = `${baseName}-${Date.now()}-${Math.floor(Math.random()*10000)}${extension}`;

    const filepath = path.join(directorio, nombreUnico);

    // Mover archivo físico
    await archivo.mv(filepath);

    // Insertar registro en la tabla archivos
    const [result] = await db.query(
      "INSERT INTO archivos (nombre, ruta, id_diagnostico, fecha_subida) VALUES (?, ?, ?, NOW())",
      [archivo.name, nombreUnico, id_diagnostico]
    );

    res.status(201).json({
      mensaje: "Archivo guardado",
      id_archivo: result.insertId,
      nombreOriginal: archivo.name,
      ruta: nombreUnico,
      id_diagnostico
    });
  } catch (error) {
    console.error("Error al guardar archivo:", error);
    res.status(500).send("Ocurrió un error al guardar el archivo");
  }
});

// GET para descargar archivo por id_archivo
router.get("/:id_archivo", auth, verificarRol(2,3), async (req, res) => {
  const { id_archivo } = req.params;

  try {
    // 1. Buscar el archivo en la base de datos
    const [rows] = await db.query(
      "SELECT nombre, ruta FROM archivos WHERE id_archivo = ?",
      [id_archivo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Archivo no encontrado en la base de datos" });
    }

    const { nombre, ruta } = rows[0];
    const filepath = path.join(directorio, ruta);

    // 2. Verificar que el archivo exista físicamente
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Archivo físico no encontrado" });
    }

    // 3. Descargar el archivo con su nombre original
    res.download(filepath, nombre);
  } catch (error) {
    console.error("Error en GET /archivos/:id_archivo:", error);
    res.status(500).send("Ocurrió un error al descargar el archivo");
  }
});
module.exports = router;