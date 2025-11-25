import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs'; // Adicionado
import { fileURLToPath } from 'url';
import * as sp from "./salvar_participantes.js";
import * as sortear from "./sortear.js";
import * as whatsapp from './enviar_mensagem.js';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import 'dotenv/config';
import webhookRoutes from './routes/webhookRoutes.js';
import { formatarTelefone } from './util/telefone.js';
import * as log from './util/log.js';
import bcrypt from 'bcryptjs';
import { authMiddleware, signToken } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// GARANTE QUE A PASTA UPLOADS EXISTE
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => res.redirect('/login.html'));
app.use('/api', webhookRoutes);

async function assertEventoDoUsuario(userId, eventId) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const rows = await dbOperations.executarConsulta(connection, 'SELECT id FROM events WHERE id = ? AND user_id = ?', [eventId, userId]);
        if (rows.length === 0) {
            const err = new Error('Evento não encontrado ou acesso negado.');
            err.status = 403;
            throw err;
        }
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios.' });
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const rows = await dbOperations.executarConsulta(connection, 'SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(409).json({ error: 'Email já cadastrado.' });
        const hash = await bcrypt.hash(password, 10);
        await dbOperations.inserir(connection, 'users', { name, email, password_hash: hash });
        const u = (await dbOperations.executarConsulta(connection, 'SELECT id, name, email FROM users WHERE email = ?', [email]))[0];
        res.json({ token: signToken({ id: u.id, email: u.email, name: u.name }), user: u });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios.' });
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const rows = await dbOperations.executarConsulta(connection, 'SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
        if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const u = rows[0];
        res.json({ token: signToken({ id: u.id, email: u.email, name: u.name }), user: { id: u.id, name: u.name, email: u.email } });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

// --- ROTAS DE EVENTOS (PROTEGIDAS) ---
app.use('/api/user', authMiddleware);

app.get('/api/user/events', async (req, res) => {
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const eventos = await dbOperations.executarConsulta(connection, 'SELECT id, name, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(eventos);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.get('/api/user/events/:id', async (req, res) => {
    let connection;
    try {
        const eventId = parseInt(req.params.id);
        connection = await mysqlConnector.conectarMySQL();
        const rows = await dbOperations.executarConsulta(connection, 'SELECT * FROM events WHERE id = ? AND user_id = ?', [eventId, req.user.id]);
        if(rows.length === 0) return res.status(404).json({ error: 'Evento não encontrado' });
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.post('/api/user/events', async (req, res) => {
    const { name } = req.body || {};
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'Nome do evento é obrigatório.' });
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.inserir(connection, 'events', { user_id: req.user.id, name: String(name).trim() });
        const criado = await dbOperations.executarConsulta(connection, 'SELECT * FROM events WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
        res.json({ message: 'Evento criado!', event: criado[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.put('/api/user/events/:id', async (req, res) => {
    const eventId = parseInt(req.params.id);
    const { name, msg_template_draw, msg_template_test } = req.body;
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (msg_template_draw !== undefined) updateData.msg_template_draw = msg_template_draw;
        if (msg_template_test !== undefined) updateData.msg_template_test = msg_template_test;
        if (Object.keys(updateData).length > 0) {
            await dbOperations.atualizar(connection, 'events', updateData, 'id = ? AND user_id = ?', [eventId, req.user.id]);
        }
        res.json({ message: 'Evento atualizado com sucesso.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.delete('/api/user/events/:id', async (req, res) => {
    const eventId = parseInt(req.params.id);
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.executarTransacao(connection, async (trx) => {
            await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE event_id = ?', [eventId]);
            await dbOperations.executarConsulta(trx, 'DELETE FROM participantes WHERE event_id = ?', [eventId]);
            await dbOperations.executarConsulta(trx, 'DELETE FROM events WHERE id = ? AND user_id = ?', [eventId, req.user.id]);
        });
        res.json({ message: 'Evento excluído.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

// PARTICIPANTES (Upload)
app.post('/api/user/events/:eventId/participantes', upload.single('arquivoCSV'), async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    if (!req.file || !eventId) return res.status(400).json({ error: 'Dados inválidos.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const msg = await sp.salvarParticipantesPorEvento(req.file.path, req.user.id, eventId);
        res.json({ message: msg });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || e.toString() });
    }
});

app.post('/api/user/events/:eventId/sortear', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const msg = await sortear.realizarSorteioPorEvento(req.user.id, eventId);
        res.json({ message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/events/:eventId/enviar', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const msg = await whatsapp.enviarMensagemPorEvento(req.user.id, eventId);
        res.json({ message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/events/:eventId/testar', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const msg = await whatsapp.enviarTestePorEvento(req.user.id, eventId);
        res.json({ message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user/events/:eventId/participantes', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const rows = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes WHERE user_id=? AND event_id=?', [req.user.id, eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.post('/api/user/events/:eventId/participantes/manual', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const { nome, telefone, grupo } = req.body;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        let connection = await mysqlConnector.conectarMySQL();
        const tel = formatarTelefone(telefone);
        if(!tel) throw new Error('Telefone inválido');
        await dbOperations.inserir(connection, 'participantes', { nome, telefone: tel, grupo: grupo || null, user_id: req.user.id, event_id: eventId });
        await mysqlConnector.fecharConexaoMySQL(connection);
        res.json({ message: 'Adicionado.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/user/events/:eventId/participantes/:id', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const id = parseInt(req.params.id);
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const { confirmacao_recebimento } = req.body;
        if(confirmacao_recebimento !== undefined) {
            await dbOperations.atualizar(connection, 'participantes', { confirmacao_recebimento }, 'id=? AND event_id=?', [id, eventId]);
        }
        res.json({ message: 'Atualizado.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.put('/api/user/events/:eventId/participantes/confirmar-todos', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.atualizar(connection, 'participantes', { confirmacao_recebimento: 1 }, 'event_id=? AND user_id=?', [eventId, req.user.id]);
        res.json({ message: 'Todos confirmados.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.delete('/api/user/events/:eventId/participantes', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.executarConsulta(connection, 'DELETE FROM sorteio WHERE event_id=?', [eventId]);
        await dbOperations.executarConsulta(connection, 'DELETE FROM participantes WHERE event_id=?', [eventId]);
        res.json({ message: 'Limpo.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

app.get('/api/user/events/:eventId/sorteio', async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const sql = `SELECT s.id, p1.nome as participante_nome, p2.nome as amigo_nome, s.mensagem_enviada 
                     FROM sorteio s JOIN participantes p1 ON s.id_participante=p1.id JOIN participantes p2 ON s.id_amigo=p2.id 
                     WHERE s.event_id=?`;
        const rows = await dbOperations.executarConsulta(connection, sql, [eventId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if(connection) await mysqlConnector.fecharConexaoMySQL(connection); }
});

// Middleware de erro global para evitar "loading infinito" se algo quebrar feio
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ error: 'Erro interno no servidor: ' + err.message });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));