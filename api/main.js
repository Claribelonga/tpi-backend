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
router.use("/usuarios" , usuariosRouter); //mixto, cliente y usuario no registrado, lito
router.use("/servicios" , serviciosRouter); //admin, vete lito
router.use("/clientes", auth, verificarRol(1), clientesRouter); //admin, lito
router.use("/veterinarios" , veterinariosRouter); //mixto admin y vete
router.use("/especies" , auth, verificarRol(3), especiesRouter); //cliente, lito
router.use("/publico" , publicoRouter);// sin verificar rol, lito
router.use("/mascotas" , auth, verificarRol(2,3), mascotasRouter); //cliente, lito
router.use("/turnos" , turnosRouter);//mixto cliente y vete, lito
router.use("/diagnosticos" , auth, verificarRol(2,3), diagnosticosRouter); //cliente, lito
router.use("/especialidades", auth, verificarRol(1), especialidadesRouter); //admin, lito
router.use("/pruebas" , pruebasRouter);
//endpoint
router.get('/', function(req, res, next){
    res.send("archivo principal de la api");
})

module.exports = router;