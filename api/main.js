const router = require("express").Router();
const { auth, verificarRol } = require("./middleware");

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
const archivosRouter = require('./archivos/main');

router.use("/usuarios" , usuariosRouter); //mixto, cliente y usuario no registrado
router.use("/servicios" , serviciosRouter); //mixto, admin y vete 
router.use("/clientes", auth, verificarRol(1), clientesRouter); //admin
router.use("/veterinarios" , veterinariosRouter); //mixto, admin y vete
router.use("/especies" , auth, verificarRol(3), especiesRouter); //cliente
router.use("/publico" , publicoRouter);// sin verificar rol
router.use("/mascotas" , mascotasRouter); //mixto, cliente y vete 
router.use("/turnos" , turnosRouter);//mixto, cliente y vete
router.use("/diagnosticos" , diagnosticosRouter); //mixto, cliente y vete
router.use("/especialidades", auth, verificarRol(1), especialidadesRouter); //admin
router.use("/archivos", archivosRouter); //vete y capaz cliente 
//endpoint
router.get('/', function(req, res, next){
    res.send("archivo principal de la api");
})

module.exports = router;