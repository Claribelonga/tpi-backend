const router = require("express").Router();
const { auth, verificarRol } = require("./middleware");


//const middleware = require('./middleware');

//const alumnosRouter = require("./alumnos/main");
const usuariosRouter = require("./usuarios/main");
const serviciosRouter = require("./servicios/main");
const especialidadesRouter = require("./especialidades/main");
const clientesRouter = require("./clientes/main");
const veterinariosRouter = require("./veterinarios/main");
const especiesRouter = require("./especies/main");
const publicoRouter = require('./publico/main');
const mascotasRouter = require('./mascotas/main');
const turnosRouter = require('./turnos/main');
const pruebasRouter = require('./pruebas')
//validaruser va a ser nuestro middleware

//router.use("/alumnos", middleware, alumnosRouter);
router.use("/usuarios" , usuariosRouter);
router.use("/servicios" , serviciosRouter);
router.use("/especialidades" , especialidadesRouter);
router.use("/clientes", auth, verificarRol(1), clientesRouter);
router.use("/veterinarios" , veterinariosRouter);
router.use("/especies" , especiesRouter);
router.use("/publico" , publicoRouter);
router.use("/mascotas" , mascotasRouter);
router.use("/turnos" , turnosRouter);
router.use("/pruebas" , pruebasRouter);
//endpoint
router.get('/', function(req, res, next){
    res.send("archivo principal de la api");
})

module.exports = router;