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

// Configurações básicas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
// Serve os arquivos estáticos (o frontend) da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// --- ROTAS DE FLUXO PRINCIPAL ---

// Rota: Upload e Salvar Participantes (Sobrescreve/Limpa)
app.post('/api/participantes', upload.single('arquivoCSV'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    try {
        const resultado = await sp.salvarParticipantes(req.file.path);
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Rota: Realizar Sorteio
app.post('/api/sortear', async (req, res) => {
    try {
        const resultado = await sortear.realizarSorteio();
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Rota: Enviar Mensagens (Oficiais)
app.post('/api/enviar', async (req, res) => {
    try {
        const resultado = await whatsapp.enviarMensagem();
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// --- ROTAS ADICIONAIS DE GERENCIAMENTO ---

// Rota: Listar Participantes
app.get('/api/participantes/listar', async (req, res) => {
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const participantes = await dbOperations.executarConsulta(connection, 'SELECT id, nome, telefone, grupo FROM participantes');
        res.json(participantes);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Rota: Adicionar Participante Manualmente
app.post('/api/participantes/manual', async (req, res) => {
    const { nome, telefone, grupo } = req.body;

    if (!nome || !telefone) {
        return res.status(400).json({ error: 'Nome e Telefone são obrigatórios.' });
    }

    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        const novoParticipante = { nome, telefone, grupo: grupo || null };
        await dbOperations.inserir(connection, 'participantes', novoParticipante);
        res.json({ message: `Participante ${nome} adicionado com sucesso!` });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Rota: Limpar Banco de Dados (Apagar tudo)
app.delete('/api/participantes', async (req, res) => {
    let connection;
    try {
        connection = await mysqlConnector.conectarMySQL();
        await dbOperations.resetarTabela(connection, 'sorteio');
        await dbOperations.resetarTabela(connection, 'participantes');
        res.json({ message: 'Todos os dados (sorteio e participantes) foram apagados.' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Rota: Enviar Mensagem de Teste
app.post('/api/testar', async (req, res) => {
    try {
        const resultado = await whatsapp.enviarTeste();
        res.json({ message: resultado });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Rota: Receber mensagens do WhatsApp (Webhook)
app.post('/api/webhook', async (req, res) => {
    const payload = req.body;
    let connection;

    // O WAHA envia vários tipos de eventos, focamos em 'message'
    if (payload.event === 'message') {
        const mensagem = payload.payload;

        // --- TRATAMENTO DE RESPOSTA DE BOTÃO (TESTE) ---
        if (mensagem.selectedButtonId) {
            const telefone = mensagem.from.split('@')[0];
            const buttonId = mensagem.selectedButtonId;
            const nomeContato = mensagem._data?.notifyName || 'Desconhecido';

            if (buttonId === 'TESTE_OK') {
                console.log(`✅ CONFIRMAÇÃO DE TESTE RECEBIDA!`);
                console.log(`   De: ${nomeContato} (${telefone})`);
            }
        }
        // --- TRATAMENTO DE MENSAGEM DE TEXTO NORMAL ---
        else if (!mensagem.fromMe && mensagem.body) {
            const telefone = mensagem.from.split('@')[0];
            const texto = mensagem.body;
            const nomeContato = mensagem._data?.notifyName || 'Desconhecido';

            console.log(`📩 NOVA MENSAGEM RECEBIDA!`);
            console.log(`   De: ${nomeContato} (${telefone})`);
            console.log(`   Dizendo: "${texto}"`);
        }
    }

    // Sempre responda 200 OK para o WAHA.
    res.status(200).send('OK');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});