const router = require("express").Router();

//const middleware = require('./middleware');

//const alumnosRouter = require("./alumnos/main");
const usuariosRouter = require("./usuarios/main");
const serviciosRouter = require("./servicios/main");
const especialidadesRouter = require("./especialidades/main");
const clientesRouter = require("./clientes/main");
const veterinariosRouter = require("./veterinarios/main");
const especiesRouter = require("./especies/main");
const publicoRouter = require('./publico/main')
const pruebasRouter = require('./pruebas')
//validaruser va a ser nuestro middleware

//router.use("/alumnos", middleware, alumnosRouter);
router.use("/usuarios" , usuariosRouter);
router.use("/servicios" , serviciosRouter);
router.use("/especialidades" , especialidadesRouter);
router.use("/clientes" , clientesRouter);
router.use("/veterinarios" , veterinariosRouter);
router.use("/especies" , especiesRouter);
router.use("/publico" , publicoRouter);
router.use("/pruebas" , pruebasRouter);
//endpoint
router.get('/', function(req, res, next){
    res.send("archivo principal de la api");
})

module.exports = router;