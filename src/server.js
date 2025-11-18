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

// Configurações básicas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
// Serve os arquivos estáticos (o frontend) da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Rota 1: Upload e Salvar Participantes
app.post('/api/participantes', upload.single('arquivoCSV'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    try {
        const resultado = await sp.salvarParticipantes(req.file.path);
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Rota 2: Realizar Sorteio
app.post('/api/sortear', async (req, res) => {
    try {
        const resultado = await sortear.realizarSorteio();
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Rota 3: Enviar Mensagens
app.post('/api/enviar', async (req, res) => {
    try {
        const resultado = await whatsapp.enviarMensagem();
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// 1. Listar Participantes
app.get('/api/participantes/listar', async (req, res) => {
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const participantes = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes');
        res.json(participantes);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// 2. Adicionar Participante Manualmente
app.post('/api/participantes/manual', async (req, res) => {
    const { nome, telefone, grupo } = req.body;

    if (!nome || !telefone) {
        return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
    }

    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const novoParticipante = { nome, telefone, grupo: grupo || '' };
        await dbOperations.inserir(connection, 'participantes', novoParticipante);
        res.json({ message: `Participante ${nome} adicionado com sucesso!` });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// 3. Limpar Banco de Dados (Opcional, útil para testes)
app.delete('/api/participantes', async (req, res) => {
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.resetarTabela(connection, 'sorteio');
        await dbOperations.resetarTabela(connection, 'participantes');
        res.json({ message: 'Todos os dados foram apagados.' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

app.post('/api/testar', async (req, res) => {
    try {
        const resultado = await whatsapp.enviarTeste();
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});