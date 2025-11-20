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
import { getTestMessageTemplate, setTestMessageTemplate, getDrawMessageTemplate, setDrawMessageTemplate } from './config/appConfig.js';

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

// Rota: Atualizar Participante (editar nome, telefone e grupo)
app.put('/api/participantes/:id', async (req, res) => {
    let connection;
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        let { nome, telefone, grupo } = req.body || {};

        const setParams = {};
        if (typeof nome === 'string' && nome.trim() !== '') setParams.nome = nome.trim();
        if (typeof grupo === 'string') setParams.grupo = grupo.trim() === '' ? null : grupo.trim();
        if (typeof telefone === 'string') {
            const telFormatado = formatarTelefone(telefone);
            if (!telFormatado) {
                return res.status(400).json({ error: 'Telefone inválido após formatação.' });
            }
            setParams.telefone = telFormatado;
        }

        if (Object.keys(setParams).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });
        }

        connection = await mysqlConnector.conectarMySQL();
        // Se o telefone for informado, verificar se mudou para zerar a confirmação
        if (setParams.telefone) {
            const atualRows = await dbOperations.executarConsulta(connection, 'SELECT telefone FROM participantes WHERE id = ?', [id]);
            if (atualRows.length === 0) {
                return res.status(404).json({ error: 'Participante não encontrado.' });
            }
            const telefoneAtual = (atualRows[0].telefone || '').toString();
            if (telefoneAtual !== setParams.telefone) {
                setParams.confirmacao_recebimento = 0; // volta para pendente
            }
        }

        const result = await dbOperations.atualizar(connection, 'participantes', setParams, 'id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Participante não encontrado.' });
        }
        res.json({ message: 'Participante atualizado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
    }
});

// Rota: Listar Resultado do Sorteio
app.get('/api/sorteio/listar', async (req, res) => {
    let connection;
    try {
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
            ORDER BY p1.nome ASC`;

        const resultado = await dbOperations.executarConsulta(connection, sql);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
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

// --- ROTAS DE CONFIGURAÇÃO ---

// Obter template da mensagem de teste
app.get('/api/config/test-message', async (req, res) => {
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
app.put('/api/config/test-message', async (req, res) => {
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
app.get('/api/config/draw-message', async (req, res) => {
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
app.put('/api/config/draw-message', async (req, res) => {
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

// Rota: Receber mensagens do WhatsApp (Webhook) agora em routes/webhookRoutes


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