import { createPool } from 'mysql2/promise';
import config from '../config/db.js';
import * as log from "../util/log.js";

// Cria um pool único para toda a aplicação
let pool;

function getPool() {
    if (!pool) {
        pool = createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: config.waitForConnections ?? true,
            connectionLimit: Number(config.connectionLimit ?? 10),
            queueLimit: Number(config.queueLimit ?? 0),
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            multipleStatements: false,
        });
        log.gravarLog(' - Pool de conexões MySQL inicializado.');
    }
    return pool;
}

export async function conectarMySQL() {
    const p = getPool();
    const connection = await p.getConnection();
    // Garante o modo seguro por conexão, se necessário
    log.gravarLog(' - Conexão ao banco de dados obtida do pool.');
    return connection;
}

export async function fecharConexaoMySQL(connection) {
    try {
        if (connection) connection.release();
    } finally {
        log.gravarLog(' - Conexão ao banco de dados devolvida ao pool.');
    }
}

// Encerrar o pool (quando a aplicação finalizar)
export async function encerrarPool() {
    if (pool) {
        await pool.end();
        pool = null;
        log.gravarLog(' - Pool de conexões MySQL encerrado.');
    }
}
