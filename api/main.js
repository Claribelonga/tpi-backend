const router = require("express").Router();
const { auth, verificarRol } = require("./middleware");


//const middleware = require('./middleware');

//const alumnosRouter = require("./alumnos/main");
const usuariosRouter = require("./usuarios/main");
const serviciosRouter = require("./servicios/main");
const clientesRouter = require("./clientes/main");
const veterinariosRouter = require("./veterinarios/main");
const especiesRouter = require("./especies/main");
const publicoRouter = require('./publico/main');
const mascotasRouter = require('./mascotas/main');
const turnosRouter = require('./turnos/main');
const diagnosticosRouter = require('./diagnosticos/main');
const especialidadesRouter = require('./especialidades/main');
const pruebasRouter = require('./pruebas')
//validaruser va a ser nuestro middleware

//router.use("/alumnos", middleware, alumnosRouter);
router.use("/usuarios" , usuariosRouter); //mixto, cliente y usuario no registrado, listo
router.use("/servicios" , serviciosRouter); //admin, vete listo
router.use("/clientes", auth, verificarRol(1), clientesRouter); //admin, listo
router.use("/veterinarios" , veterinariosRouter); //mixto admin y vete
router.use("/especies" , auth, verificarRol(3), especiesRouter); //cliente, listo
router.use("/publico" , publicoRouter);// sin verificar rol, listo
router.use("/mascotas" , auth, verificarRol(2,3), mascotasRouter); //cliente, listo
router.use("/turnos" , turnosRouter);//mixto cliente y vete, listo
router.use("/diagnosticos", diagnosticosRouter); //vete y cliente, listo
router.use("/especialidades", auth, verificarRol(1), especialidadesRouter); //admin, listo
router.use("/pruebas" , pruebasRouter);
//endpoint
router.get('/', function(req, res, next){
    res.send("archivo principal de la api");
})

module.exports = router;