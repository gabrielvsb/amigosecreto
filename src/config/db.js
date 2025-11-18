import 'dotenv/config'; // Garante que lê o .env se rodar localmente

export default {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};