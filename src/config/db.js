export default {
    host: process.env.DB_HOST || '127.0.0.1',
    port: '3306',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'db_amigo_secreto',
};