import axios from 'axios';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagemUtil from "./util/mensagem.js";
import * as log from './util/log.js';

// Usando variáveis de ambiente
const WAHA_URL = process.env.WAHA_URL;
const WAHA_KEY = process.env.WAHA_API_KEY;

export async function enviarMensagem() {
    const connection = await mysqlConnector.conectarMySQL();

    if (!WAHA_URL || !WAHA_KEY) {
        log.gravarLog('ERRO: Configurações do WAHA (URL ou KEY) não encontradas no ambiente.');
        await mysqlConnector.fecharConexaoMySQL(connection);
        return 'Erro de configuração do servidor.';
    }

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
            'X-Api-Key': WAHA_KEY
        }
    };

    for (const registro of sorteio) {
        const texto = mensagemUtil.montarMensagem(registro.nome_participante, registro.nome_amigo);
        let telefone = registro.telefone.replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
        const chatId = `${telefone}@c.us`;

        try {
            log.gravarLog(` - Enviando para: ${registro.nome_participante} (${chatId})`);

            const body = {
                session: 'default',
                chatId: chatId,
                text: texto
            };

            await axios.post(`${WAHA_URL}/api/sendText`, body, config);

            // TODO: Você pode descomentar esta linha se quiser marcar a mensagem como enviada no banco
            // await connection.query('UPDATE sorteio SET mensagem_enviada = 1 WHERE id = ?', [registro.id_sorteio]);

            enviadas++;
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
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


// FUNÇÃO: Enviar mensagem de teste (Revertido para Texto Simples)
export async function enviarTeste() {
    const connection = await mysqlConnector.conectarMySQL();

    const participantes = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes');

    if (participantes.length <= 0) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        return ' - Não há participantes cadastrados para testar.';
    }

    if (!WAHA_URL || !WAHA_KEY) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        throw new Error('Configurações do WAHA ausentes.');
    }

    log.gravarLog('- Iniciando TESTE de envio de texto simples...');

    let enviados = 0;
    let erros = 0;

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': WAHA_KEY
        }
    };

    for (const p of participantes) {
        let telefone = p.telefone.replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
        const chatId = `${telefone}@c.us`;

        // Mensagem de texto simples instruindo a resposta manual
        const mensagemTeste = `🤖 *Teste de Conexão - Amigo Secreto*\n\nOlá ${p.nome}, este é um teste de verificação de número. Por favor, responda APENAS com a palavra "OK" para confirmar que seu número está correto.`;

        // Payload de texto simples
        const payload = {
            session: 'default',
            chatId: chatId,
            text: mensagemTeste,
        };

        try {
            log.gravarLog(` - Testando envio de TEXTO SIMPLES para ${p.nome} (${chatId})`);

            // Endpoint CORRETO para WEBJS
            await axios.post(`${WAHA_URL}/api/sendText`, payload, config);

            enviados++;
            await new Promise(r => setTimeout(r, 500));

        } catch (error) {
            const errorMsg = error.response ?
                `Status ${error.response.status} - ${JSON.stringify(error.response.data)}` :
                error.message;
            log.gravarLog(` - ERRO no teste para ${p.nome}: ${errorMsg}`);
            erros++;
        }
    }

    await mysqlConnector.fecharConexaoMySQL(connection);
    return `Teste finalizado: ${enviados} enviados, ${erros} falhas.`;
}