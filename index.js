const express = require('express');

require('dotenv').config();

const{PORT} = process.env;

const apiRouter = require('./api/main');

const app = express();

app.use(express.json());

//https://phpmyadmin.ctpoba.edu.ar

//npm i @damianegreco/hashpass, es la libreria del profeuwu

app.use('/api', apiRouter);

app.listen(PORT, function(error){
 if(error){
    console.error(error);
    process.exit(1);
 }
console.log(`escuchando em el puerto ${PORT}`);
})