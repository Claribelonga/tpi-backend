const express = require('express');
const router = express.Router();
const { auth, verificarRol } = require('./middleware');

// Solo admin
router.get('/admin', auth, verificarRol(2), (req, res) => {
  res.send("Panel de administración");
});

// Admin y vete
router.get('/mascotas', auth, verificarRol('admin', 'vete'), (req, res) => {
  res.send("Gestión de mascotas");
});

// Todos los roles autenticados
router.get('/perfil', auth, (req, res) => {
  res.send(`Hola ${req.user.nombre}, tu rol es ${req.user.rol}`);
});

module.exports = router;
