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
import axios from 'axios'; // Importa axios para a resposta automática

// Configurações básicas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
// Serve os arquivos estáticos (o frontend) da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Variáveis de Ambiente para resposta automática
const WAHA_URL = process.env.WAHA_URL;
const WAHA_KEY = process.env.WAHA_API_KEY;

// Função auxiliar para enviar mensagem de volta via WAHA
async function sendWahaMessage(chatId, text) {
    if (!WAHA_URL || !WAHA_KEY) {
        console.error('ERRO: Configurações do WAHA (URL ou KEY) ausentes para resposta.');
        return;
    }
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': WAHA_KEY
        }
    };
    const body = {
        session: 'default',
        chatId: chatId,
        text: text
    };
    try {
        await axios.post(`${WAHA_URL}/api/sendText`, body, config);
        console.log(`🤖 Resposta automática enviada para ${chatId}.`);
    } catch (error) {
        console.error(`ERRO ao enviar resposta automática para ${chatId}:`, error.message);
    }
}

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
        // Inclui o novo campo na consulta
        const participantes = await dbOperations.executarConsulta(connection, 'SELECT id, nome, telefone, grupo, confirmacao_recebimento FROM participantes');
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

        // Função de formatação para garantir o 55
        function formatarTelefone(telefone) {
            if (!telefone) return null;
            let num = telefone.replace(/\D/g, '');
            if (num.length >= 10 && !num.startsWith('55')) {
                num = '55' + num;
            }
            return num;
        }

        const telefoneFormatado = formatarTelefone(telefone);
        if (!telefoneFormatado) {
            return res.status(400).json({ error: 'Telefone inválido após formatação.' });
        }

        const novoParticipante = { nome, telefone: telefoneFormatado, grupo: grupo || null };
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

    if (payload.event === 'message') {
        const mensagem = payload.payload;

        // Ignora mensagens enviadas por você mesmo ou sem corpo
        if (mensagem.fromMe || !mensagem.body) return res.status(200).send('OK');

        // O WAHA envia o número no formato 55xxxxxxxxxxx@c.us. Removemos o @c.us e só os dígitos.
        const telefone_db = mensagem.from.split('@')[0].replace(/\D/g, '');

        // Normaliza o texto para aceitar 'OK' (case-insensitive)
        const texto = mensagem.body.trim().toUpperCase();
        const nomeContato = mensagem._data?.notifyName || 'Desconhecido';

        console.log(`📩 NOVA MENSAGEM RECEBIDA!`);
        console.log(`   De: ${nomeContato} (Telefone DB: ${telefone_db})`);
        console.log(`   Dizendo: "${texto}"`);

        // LÓGICA DE CONFIRMAÇÃO DE TESTE: Aceita 'OK' (já normalizado para maiúsculas)
        if (texto === 'OK') {
            try {
                connection = await mysqlConnector.conectarMySQL();

                // 1. Verifica quantos participantes PENDENTES têm este número
                const querySelect = 'SELECT COUNT(id) AS count FROM participantes WHERE telefone = ? AND confirmacao_recebimento = 0';
                // Executa a consulta e pega o array de rows (Ex: [{count: 1}])
                const resultRows = await dbOperations.executarConsulta(connection, querySelect, [telefone_db]);

                // FIX: Acessa a propriedade 'count' da primeira linha ou usa 0 se for undefined
                const naoConfirmados = resultRows[0]?.count || 0;
                const chatId = mensagem.from;

                if (naoConfirmados > 0) {
                    // 2. Atualiza TODOS os participantes com este telefone
                    const queryUpdate = 'UPDATE participantes SET confirmacao_recebimento = 1 WHERE telefone = ?';
                    // Usamos connection.query para obter o changedRows
                    const [updateResult] = await connection.query(queryUpdate, [telefone_db]);

                    const totalAtualizado = updateResult.changedRows;
                    console.log(`✅ CONFIRMAÇÃO SALVA: ${totalAtualizado} registro(s) confirmado(s) para o número ${telefone_db}.`);

                    // 3. Envia a mensagem de confirmação para o usuário
                    const mensagemResposta = `*Participação confirmada!* Em breve o sorteio será realizado e você receberá ${totalAtualizado > 1 ? 'os nomes dos seus amigos secretos' : 'o nome do seu amigo secreto'}.`;

                    await sendWahaMessage(chatId, mensagemResposta);

                } else {
                    console.log(`⚠️ NENHUM REGISTRO PENDENTE encontrado para o número: ${telefone_db}.`);
                }

            } catch (error) {
                console.error('Erro ao processar confirmação no DB:', error);

            } finally {
                if(connection) await mysqlConnector.fecharConexaoMySQL(connection);
            }
        }
    }

    res.status(200).send('OK');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});