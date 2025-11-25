import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sp from "./salvar_participantes.js";
import * as sortear from "./sortear.js";
import * as whatsapp from './enviar_mensagem.js';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import 'dotenv/config'; // Garante que as variáveis de ambiente sejam carregadas
// axios removido: envio de mensagens via webhook agora está em services/wahaService
import webhookRoutes from './routes/webhookRoutes.js';
import { formatarTelefone } from './util/telefone.js';
import * as log from './util/log.js';
import { getTestMessageTemplate, setTestMessageTemplate, getDrawMessageTemplate, setDrawMessageTemplate } from './config/appConfig.js';
import bcrypt from 'bcryptjs';
import { authMiddleware, signToken } from './middleware/auth.js';

// Configurações básicas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
// Serve os arquivos estáticos (o frontend) da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Rotas modulares
app.use('/api', webhookRoutes);

// Helper: valida se o evento pertence ao usuário logado
async function assertEventoDoUsuario(userId, eventId) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const rows = await dbOperations.executarConsulta(
            connection,
            'SELECT id FROM events WHERE id = ? AND user_id = ?',
            [eventId, userId]
        );
        if (rows.length === 0) {
            const err = new Error('Evento não encontrado para este usuário.');
            err.status = 404;
            throw err;
        }
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

// --- AUTENTICAÇÃO ---
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const rows = await dbOperations.executarConsulta(connection, 'SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(409).json({ error: 'Email já cadastrado.' });
        const password_hash = await bcrypt.hash(password, 10);
        await dbOperations.inserir(connection, 'users', { name: name || null, email, password_hash });
        const user = await dbOperations.executarConsulta(connection, 'SELECT id, name, email FROM users WHERE email = ?', [email]);
        const u = user[0];
        const token = signToken({ id: u.id, email: u.email, name: u.name });
        res.json({ token, user: u });
    } catch (e) {
        res.status(500).json({ error: e.message || e.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const rows = await dbOperations.executarConsulta(connection, 'SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });
        const u = rows[0];
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return res.status(401).json({ error: 'Credenciais inválidas.' });
        const token = signToken({ id: u.id, email: u.email, name: u.name });
        res.json({ token, user: { id: u.id, name: u.name, email: u.email } });
    } catch (e) {
        res.status(500).json({ error: e.message || e.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// --- EVENTOS (PROTEGIDOS) ---
app.get('/api/user/events', authMiddleware, async (req, res) => {
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const eventos = await dbOperations.executarConsulta(connection, 'SELECT id, name, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(eventos);
    } catch (e) {
        res.status(500).json({ error: e.message || e.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

app.post('/api/user/events', authMiddleware, async (req, res) => {
    const { name } = req.body || {};
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'Nome do evento é obrigatório.' });
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.inserir(connection, 'events', { user_id: req.user.id, name: String(name).trim() });
        const criado = await dbOperations.executarConsulta(connection, 'SELECT id, name, created_at FROM events WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
        res.json({ message: 'Evento criado com sucesso.', event: criado[0] });
    } catch (e) {
        res.status(500).json({ error: e.message || e.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Upload de participantes por evento
app.post('/api/user/events/:eventId/participantes', authMiddleware, upload.single('arquivoCSV'), async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const mensagem = await sp.salvarParticipantesPorEvento(req.file.path, req.user.id, eventId);
        res.json({ message: mensagem });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || e.toString() });
    }
});

// Sorteio por evento
app.post('/api/user/events/:eventId/sortear', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const msg = await sortear.realizarSorteioPorEvento(req.user.id, eventId);
        res.json({ message: msg });
    } catch (e) {
        log.gravarLog(` - Erro ao realizar sorteio por evento: ${e?.message || e}`);
        res.status(e.status || 500).json({ error: e.message || e.toString() });
    }
});

// Enviar mensagens do evento
app.post('/api/user/events/:eventId/enviar', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const msg = await whatsapp.enviarMensagemPorEvento(req.user.id, eventId);
        res.json({ message: msg });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || e.toString() });
    }
});

// --- ROTAS PROTEGIDAS DE GERENCIAMENTO POR EVENTO ---

// Listar participantes do evento (protegido)
app.get('/api/user/events/:eventId/participantes', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const participantes = await dbOperations.executarConsulta(
            connection,
            'SELECT id, nome, telefone, grupo, confirmacao_recebimento FROM participantes WHERE user_id = ? AND event_id = ? ORDER BY id ASC',
            [req.user.id, eventId]
        );
        res.json(participantes);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Confirmar TODOS os participantes do evento
app.put('/api/user/events/:eventId/participantes/confirmar-todos', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const result = await dbOperations.atualizar(
            connection,
            'participantes',
            { confirmacao_recebimento: 1 },
            'user_id = ? AND event_id = ? AND confirmacao_recebimento = 0',
            [req.user.id, eventId]
        );
        const atualizados = result.affectedRows || 0;
        res.json({ message: `Sucesso! ${atualizados} participantes foram marcados como confirmados.` });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Atualizar um participante do evento
app.put('/api/user/events/:eventId/participantes/:id', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        let { nome, telefone, grupo, confirmacao_recebimento } = req.body || {};

        const setParams = {};
        if (typeof nome === 'string' && nome.trim() !== '') setParams.nome = nome.trim();
        if (typeof grupo === 'string') setParams.grupo = grupo.trim() === '' ? null : grupo.trim();
        if (confirmacao_recebimento !== undefined) {
            setParams.confirmacao_recebimento = (confirmacao_recebimento == 1 || confirmacao_recebimento === true) ? 1 : 0;
        }
        if (typeof telefone === 'string') {
            const telFormatado = formatarTelefone(telefone);
            if (!telFormatado) return res.status(400).json({ error: 'Telefone inválido após formatação.' });
            setParams.telefone = telFormatado;
        }
        if (Object.keys(setParams).length === 0) return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });

        connection = await mysqlConnector.conectarMySQL();
        // Resetar confirmação se telefone mudou e não foi enviado explicitamente
        if (setParams.telefone && confirmacao_recebimento === undefined) {
            const atualRows = await dbOperations.executarConsulta(
                connection,
                'SELECT telefone FROM participantes WHERE id = ? AND user_id = ? AND event_id = ?',
                [id, req.user.id, eventId]
            );
            if (atualRows.length === 0) return res.status(404).json({ error: 'Participante não encontrado.' });
            const telefoneAtual = (atualRows[0].telefone || '').toString();
            if (telefoneAtual !== setParams.telefone) setParams.confirmacao_recebimento = 0;
        }

        const result = await dbOperations.atualizar(
            connection,
            'participantes',
            setParams,
            'id = ? AND user_id = ? AND event_id = ?',
            [id, req.user.id, eventId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Participante não encontrado.' });
        res.json({ message: 'Participante atualizado com sucesso.' });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Listar resultado do sorteio do evento
app.get('/api/user/events/:eventId/sorteio', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const sql = `
            SELECT 
                s.id,
                p1.id        AS id_participante,
                p1.nome      AS participante_nome,
                p1.telefone  AS participante_telefone,
                p1.grupo     AS participante_grupo,
                p2.id        AS id_amigo,
                p2.nome      AS amigo_nome,
                p2.telefone  AS amigo_telefone,
                p2.grupo     AS amigo_grupo,
                s.mensagem_enviada
            FROM sorteio s
            JOIN participantes p1 ON p1.id = s.id_participante
            JOIN participantes p2 ON p2.id = s.id_amigo
            WHERE s.user_id = ? AND s.event_id = ?
            ORDER BY p1.nome ASC`;
        const resultado = await dbOperations.executarConsulta(connection, sql, [req.user.id, eventId]);
        res.json(resultado);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Adicionar participante manualmente no evento
app.post('/api/user/events/:eventId/participantes/manual', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const { nome, telefone, grupo } = req.body || {};
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    if (!nome || !telefone) return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        const telefoneFormatado = formatarTelefone(telefone);
        if (!telefoneFormatado) return res.status(400).json({ error: 'Telefone inválido após formatação.' });
        const novoParticipante = { nome, telefone: telefoneFormatado, grupo: (grupo || null), user_id: req.user.id, event_id: eventId };
        await dbOperations.inserir(connection, 'participantes', novoParticipante);
        res.json({ message: `Participante ${nome} adicionado com sucesso!` });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Limpar dados do evento (participantes e sorteio do usuário)
app.delete('/api/user/events/:eventId/participantes', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    let connection;
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.executarTransacao(connection, async (trx) => {
            await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE user_id = ? AND event_id = ?', [req.user.id, eventId]);
            await dbOperations.executarConsulta(trx, 'DELETE FROM participantes WHERE user_id = ? AND event_id = ?', [req.user.id, eventId]);
        });
        res.json({ message: 'Participantes e sorteio do evento foram apagados.' });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Enviar mensagem de teste para todos do evento
app.post('/api/user/events/:eventId/testar', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const resultado = await whatsapp.enviarTestePorEvento(req.user.id, eventId);
        res.json({ message: resultado });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    }
});

// Enviar teste individual para participante do evento
app.post('/api/user/events/:eventId/testar/:id', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const resultado = await whatsapp.enviarTesteIndividualPorEvento(req.user.id, eventId, id);
        res.json({ message: resultado });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    }
});

// Enviar resultado individual do sorteio para participante do evento
app.post('/api/user/events/:eventId/enviar/:id', authMiddleware, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
    try {
        await assertEventoDoUsuario(req.user.id, eventId);
        const resultado = await whatsapp.enviarResultadoIndividualPorEvento(req.user.id, eventId, id);
        res.json({ message: resultado });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || error.toString() });
    }
});

// --- ROTAS DE CONFIGURAÇÃO (PROTEGIDAS) ---

// Obter template da mensagem de teste
app.get('/api/config/test-message', authMiddleware, async (req, res) => {
    try {
        const template = getTestMessageTemplate();
        res.json({
            template,
            placeholders: ['{{nome}}', '{{telefone}}', '{{data}}', '{{hora}}']
        });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Atualizar template da mensagem de teste
app.put('/api/config/test-message', authMiddleware, async (req, res) => {
    try {
        const { template } = req.body || {};
        if (typeof template !== 'string' || template.trim() === '') {
            return res.status(400).json({ error: 'Template inválido.' });
        }
        const ok = setTestMessageTemplate(template);
        if (!ok) return res.status(500).json({ error: 'Falha ao salvar o template.' });
        res.json({ message: 'Template de mensagem de teste salvo com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Obter template da mensagem OFICIAL do sorteio
app.get('/api/config/draw-message', authMiddleware, async (req, res) => {
    try {
        const template = getDrawMessageTemplate();
        res.json({
            template,
            placeholders: ['{{participante}}', '{{amigo}}', '{{data}}', '{{hora}}']
        });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Atualizar template da mensagem OFICIAL do sorteio
app.put('/api/config/draw-message', authMiddleware, async (req, res) => {
    try {
        const { template } = req.body || {};
        if (typeof template !== 'string' || template.trim() === '') {
            return res.status(400).json({ error: 'Template inválido.' });
        }
        const ok = setDrawMessageTemplate(template);
        if (!ok) return res.status(500).json({ error: 'Falha ao salvar o template.' });
        res.json({ message: 'Template de mensagem do sorteio salvo com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});


const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Encerramento gracioso: fecha o pool ao receber sinais do SO
const shutdown = async (signal) => {
    try {
        console.log(`\nRecebido ${signal}. Encerrando servidor...`);
        server.close(async () => {
            await mysqlConnector.encerrarPool();
            process.exit(0);
        });
    } catch (e) {
        console.error('Erro ao encerrar:', e);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));