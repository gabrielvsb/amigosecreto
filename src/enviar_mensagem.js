import axios from 'axios';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagemUtil from "./util/mensagem.js";
import * as log from './util/log.js';

const WAHA_URL = process.env.WAHA_URL;
const WAHA_KEY = process.env.WAHA_API_KEY;

export async function enviarMensagem() {
    if (!WAHA_URL || !WAHA_KEY) {
        log.gravarLog('ERRO: Configurações do WAHA (URL ou KEY) não encontradas no ambiente.');
        return 'Erro de configuração do servidor.';
    }

    const connection = await mysqlConnector.conectarMySQL();

    const query = `
        SELECT s.id as id_sorteio, p.nome as nome_participante, p.telefone, a.nome as nome_amigo
        FROM sorteio s
                 INNER JOIN participantes p ON s.id_participante = p.id
                 INNER JOIN participantes a ON s.id_amigo = a.id
        WHERE s.mensagem_enviada = 0
    `;

    const sorteio = await dbOperations.executarConsulta(connection, query);

    if (sorteio.length <= 0) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        return 'Não há mensagens pendentes para enviar.';
    }

    log.gravarLog(`- Iniciando envio de ${sorteio.length} mensagens via WAHA...`);

    let enviadas = 0;
    let erros = 0;

    // Configuração dos Headers com a chave de API
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': WAHA_KEY // Envia a chave no header
        }
    };

    for (const registro of sorteio) {
        const texto = mensagemUtil.montarMensagem(registro.nome_participante, registro.nome_amigo);
        const chatId = `55${registro.telefone.replace(/\D/g, '')}@c.us`;

        try {
            log.gravarLog(` - Enviando para: ${registro.nome_participante} (${chatId})`);

            const body = {
                session: 'default',
                chatId: chatId,
                text: texto
            };

            // Passa o 'config' como terceiro parâmetro
            await axios.post(`${WAHA_URL}/api/sendText`, body, config);

            // Opcional: Marcar como enviada no banco
            // await connection.query('UPDATE sorteio SET mensagem_enviada = 1 WHERE id = ?', [registro.id_sorteio]);

            enviadas++;
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            // Log mais detalhado do erro
            const errorMsg = error.response ?
                `Status ${error.response.status} - ${JSON.stringify(error.response.data)}` :
                error.message;

            log.gravarLog(`ERRO ao enviar para ${registro.nome_participante}: ${errorMsg}`);
            erros++;
        }
    }

    await mysqlConnector.fecharConexaoMySQL(connection);
    return `Processo finalizado. Enviadas: ${enviadas}, Erros: ${erros}.`;
}

export async function enviarTeste() {
    const connection = await mysqlConnector.conectarMySQL();

    // Busca todos os participantes cadastrados
    const participantes = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes');

    if (participantes.length <= 0) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        return ' - Não há participantes cadastrados para testar.';
    }

    // Verifica se as variáveis de ambiente estão carregadas
    if (!WAHA_URL || !WAHA_KEY) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        throw new Error('Configurações do WAHA ausentes.');
    }

    log.gravarLog('- Iniciando TESTE de envio de mensagens...');

    let enviados = 0;
    let erros = 0;

    // Configuração do Header
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': WAHA_KEY
        }
    };

    for (const p of participantes) {
        // Formatação do telefone
        let telefone = p.telefone.replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
        const chatId = `${telefone}@c.us`;

        const mensagemTeste = `🤖 *Teste de Conexão - Amigo Secreto*\n\nOlá ${p.nome}, se você recebeu esta mensagem, seu número está correto no sistema!`;

        try {
            log.gravarLog(` - Testando envio para ${p.nome} (${chatId})`);

            await axios.post(`${WAHA_URL}/api/sendText`, {
                chatId: chatId,
                text: mensagemTeste,
                session: 'default'
            }, config);

            enviados++;
            // Delay curto para não bloquear
            await new Promise(r => setTimeout(r, 500));

        } catch (error) {
            log.gravarLog(` - ERRO no teste para ${p.nome}: ${error.message}`);
            erros++;
        }
    }

    await mysqlConnector.fecharConexaoMySQL(connection);
    return `Teste finalizado: ${enviados} enviados, ${erros} falhas.`;
}