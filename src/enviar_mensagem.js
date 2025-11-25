import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagemUtil from "./util/mensagem.js";
import * as log from './util/log.js';
import { sendText, isConfigured } from './services/wahaService.js';
import { renderTemplate } from './config/appConfig.js'; // Apenas o renderizador, não os getters globais

// DEFAULTS (Caso o evento não tenha template salvo)
const DEFAULT_TEST_TEMPLATE = '🤖 *Teste de Conexão*\n\nOlá *{{nome}}*, responda OK para confirmar.';
const DEFAULT_DRAW_TEMPLATE = '*AMIGO SECRETO*\n\nOlá *{{participante}}*, seu amigo secreto é: {{amigo}}.';

// Helper: Busca templates do evento
async function getTemplatesDoEvento(connection, eventId, userId) {
    const rows = await dbOperations.executarConsulta(
        connection,
        'SELECT msg_template_draw, msg_template_test FROM events WHERE id = ? AND user_id = ?',
        [eventId, userId]
    );
    if (rows.length === 0) return { draw: DEFAULT_DRAW_TEMPLATE, test: DEFAULT_TEST_TEMPLATE };

    return {
        draw: rows[0].msg_template_draw || DEFAULT_DRAW_TEMPLATE,
        test: rows[0].msg_template_test || DEFAULT_TEST_TEMPLATE
    };
}

// --- FUNÇÕES DE ENVIO ---

export async function enviarMensagemPorEvento(userId, eventId) {
    const connection = await mysqlConnector.conectarMySQL();

    if (!isConfigured()) {
        log.gravarLog('ERRO: Configurações do WAHA ausentes.');
        await mysqlConnector.fecharConexaoMySQL(connection);
        return 'Erro de configuração do servidor.';
    }

    try {
        // 1. Busca templates do evento
        const templates = await getTemplatesDoEvento(connection, eventId, userId);

        // 2. Busca sorteios pendentes
        const query = `
            SELECT s.id as id_sorteio, p.nome as nome_participante, p.telefone, a.nome as nome_amigo
            FROM sorteio s
            INNER JOIN participantes p ON s.id_participante = p.id
            INNER JOIN participantes a ON s.id_amigo = a.id
            WHERE s.mensagem_enviada = 0 AND s.user_id = ? AND s.event_id = ?
        `;
        const sorteio = await dbOperations.executarConsulta(connection, query, [userId, eventId]);

        if (sorteio.length <= 0) {
            return 'Não há mensagens pendentes para enviar neste evento.';
        }

        log.gravarLog(`- Iniciando envio de ${sorteio.length} mensagens (Evento ${eventId})...`);
        let enviadas = 0;
        let erros = 0;

        for (const registro of sorteio) {
            const agora = new Date();
            const ctx = {
                participante: registro.nome_participante,
                amigo: registro.nome_amigo,
                data: agora.toLocaleDateString('pt-BR'),
                hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };

            const texto = renderTemplate(templates.draw, ctx);
            const chatId = `${registro.telefone.replace(/\D/g, '')}@c.us`;

            try {
                await sendText(chatId, texto);
                enviadas++;
                await dbOperations.atualizar(connection, 'sorteio', { mensagem_enviada: 1 }, 'id = ?', [registro.id_sorteio]);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay respeitoso
            } catch (error) {
                log.gravarLog(`ERRO ao enviar para ${registro.nome_participante}: ${error.message}`);
                erros++;
            }
        }
        return `Envio finalizado. Sucessos: ${enviadas}, Erros: ${erros}.`;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

export async function enviarTestePorEvento(userId, eventId) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        if (!isConfigured()) throw new Error('Configurações do WAHA ausentes.');

        const templates = await getTemplatesDoEvento(connection, eventId, userId);

        const participantes = await dbOperations.executarConsulta(
            connection,
            'SELECT MIN(id) AS id, MIN(nome) AS nome, telefone FROM participantes WHERE confirmacao_recebimento = 0 AND telefone IS NOT NULL AND user_id = ? AND event_id = ? GROUP BY telefone',
            [userId, eventId]
        );

        if (participantes.length <= 0) return ' - Ninguém para testar neste evento.';

        let enviadas = 0;
        for (const p of participantes) {
            let telefone = (p.telefone || '').toString().replace(/\D/g, '');
            const chatId = `${telefone}@c.us`;

            const ctx = {
                nome: p.nome,
                telefone: telefone,
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };
            const texto = renderTemplate(templates.test, ctx);

            try {
                await sendText(chatId, texto);
                enviadas++;
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                log.gravarLog(`ERRO Teste ${p.nome}: ${e.message}`);
            }
        }
        return `Teste finalizado. Enviadas: ${enviadas}.`;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

// Funções individuais também atualizadas para usar templates do evento
export async function enviarTesteIndividualPorEvento(userId, eventId, id) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const templates = await getTemplatesDoEvento(connection, eventId, userId);
        const rows = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes WHERE id = ? AND user_id = ? AND event_id = ?', [id, userId, eventId]);
        if (rows.length === 0) throw new Error('Participante não encontrado.');

        const p = rows[0];
        const telefone = p.telefone.replace(/\D/g, '');
        const ctx = { nome: p.nome, telefone, data: new Date().toLocaleDateString('pt-BR') };

        await sendText(`${telefone}@c.us`, renderTemplate(templates.test, ctx));
        return `Teste enviado para ${p.nome}!`;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

export async function enviarResultadoIndividualPorEvento(userId, eventId, id) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const templates = await getTemplatesDoEvento(connection, eventId, userId);
        const query = `
            SELECT s.id as id_sorteio, p.nome as nome_participante, p.telefone, a.nome as nome_amigo
            FROM sorteio s
            JOIN participantes p ON s.id_participante = p.id
            JOIN participantes a ON s.id_amigo = a.id
            WHERE p.id = ? AND s.user_id = ? AND s.event_id = ?`;

        const rows = await dbOperations.executarConsulta(connection, query, [id, userId, eventId]);
        if (rows.length === 0) throw new Error('Resultado não encontrado.');

        const r = rows[0];
        const ctx = { participante: r.nome_participante, amigo: r.nome_amigo };

        await sendText(`${r.telefone.replace(/\D/g, '')}@c.us`, renderTemplate(templates.draw, ctx));
        await dbOperations.atualizar(connection, 'sorteio', { mensagem_enviada: 1 }, 'id = ?', [r.id_sorteio]);
        return `Resultado enviado para ${r.nome_participante}!`;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}