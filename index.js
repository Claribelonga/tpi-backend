const express = require('express');
const cors = require("cors");

require('dotenv').config();

const{PORT} = process.env;

const apiRouter = require('./api/main');

const app = express();

app.use(express.json());

//https://phpmyadmin.ctpoba.edu.ar

//npm i @damianegreco/hashpass, es la libreria del profeuwu
app.use(cors());

app.use('/api', apiRouter);

app.listen(PORT, function(error){
 if(error){
    console.error(error);
    process.exit(1);
 }
console.log(`escuchando en el puerto ${PORT}`);
})