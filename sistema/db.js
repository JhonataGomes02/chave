const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Seu usuário do MySQL 
    password: 'cimatec',      // Sua senha do MySQL 
    database: 'banco_saep_db'
});

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar no MySQL: ' + err.stack);
        return;
    }
    console.log('Conectado ao MySQL como ID ' + connection.threadId);
});

module.exports = connection;