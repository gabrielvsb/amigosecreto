import { createConnection } from 'mysql2/promise';
import config from '../config/db.js';

export async function conectarMySQL() {
  const connection = await createConnection(config);
  console.log('Conexão ao banco de dados estabelecida.');
  return connection;
}

export async function fecharConexaoMySQL(connection) {
  await connection.end();
  console.log('Conexão ao banco de dados fechada.');
}
