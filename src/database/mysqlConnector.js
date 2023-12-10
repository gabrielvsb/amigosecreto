import {createConnection} from 'mysql2/promise';
import config from '../config/db.js';
import * as log from "../util/log.js";

export async function conectarMySQL() {
    const connection = await createConnection(config);
    log.gravarLog(' - Conexão ao banco de dados estabelecida.');
    return connection;
}

export async function fecharConexaoMySQL(connection) {
    await connection.end();
    log.gravarLog(' - Conexão ao banco de dados fechada.')
}
