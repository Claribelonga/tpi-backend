const router = require("express").Router();

//const middleware = require('./middleware');

//const alumnosRouter = require("./alumnos/main");
const usuariosRouter = require("./usuarios/main");
const serviciosRouter = require("./servicios/main");
const especialidadesRouter = require("./especialidades/main");
const personasRouter = require("./personas/main");
const veterinariosRouter = require("./veterinarios/main");
const especiesRouter = require("./especies/main");
//validaruser va a ser nuestro middleware

//router.use("/alumnos", middleware, alumnosRouter);
router.use("/usuarios" , usuariosRouter);
router.use("/servicios" , serviciosRouter);
router.use("/especialidades" , especialidadesRouter);
router.use("/personas" , personasRouter);
router.use("/veterinarios" , veterinariosRouter);
router.use("/especies" , especiesRouter);

//endpoint
router.get('/', function(req, res, next){
    res.send("archivo principal de la api");
})

module.exports = router;