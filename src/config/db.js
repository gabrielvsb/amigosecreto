import 'dotenv/config'; // Garante que lê o .env se rodar localmente

export default {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    // Configurações do pool de conexões
    waitForConnections: (process.env.DB_WAIT_FOR_CONNECTIONS || 'true') === 'true',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || process.env.DB_POOL_LIMIT || '10', 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0', 10),
};