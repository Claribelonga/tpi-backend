const  mysql = require('mysql2/promise'); //npm install mysql2

const{DBNAME, DBUSER, DBPASS, DBHOST} = process.env;

const db = mysql.createPool({
    host: DBHOST,
    user: DBUSER,
    database: DBNAME, 
    password: DBPASS
})

module.exports = db