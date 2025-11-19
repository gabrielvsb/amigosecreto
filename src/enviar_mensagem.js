import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagemUtil from "./util/mensagem.js";
import * as log from './util/log.js';
import { sendText, isConfigured } from './services/wahaService.js';

export async function enviarMensagem() {
    const connection = await mysqlConnector.conectarMySQL();

    if (!isConfigured()) {
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

    for (const registro of sorteio) {
        const texto = mensagemUtil.montarMensagem(registro.nome_participante, registro.nome_amigo);
        // O número já deve ter o 55 no DB (ajustado em salvar_participantes)
        const chatId = `${registro.telefone.replace(/\D/g, '')}@c.us`;

        try {
            log.gravarLog(` - Enviando para: ${registro.nome_participante} (${chatId})`);
            await sendText(chatId, texto);

            enviadas++;
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Marca como enviada
            await dbOperations.atualizar(connection, 'sorteio', { mensagem_enviada: 1 }, 'id = ?', [registro.id_sorteio]);

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


// FUNÇÃO: Enviar mensagem de teste (Texto Simples para compatibilidade com WEBJS)
export async function enviarTeste() {
    const connection = await mysqlConnector.conectarMySQL();

    const participantes = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes');

    if (participantes.length <= 0) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        return ' - Não há participantes cadastrados para testar.';
    }

    if (!isConfigured()) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        throw new Error('Configurações do WAHA ausentes.');
    }

    log.gravarLog('- Iniciando TESTE de envio de texto simples...');

    let enviados = 0;
    let erros = 0;

    for (const p of participantes) {
        // O número já deve ter o 55 no DB (ajustado em salvar_participantes)
        let telefone = p.telefone.replace(/\D/g, '');
        const chatId = `${telefone}@c.us`;

        // Mensagem de texto simples instruindo a resposta manual
        const mensagemTeste = `🤖 *Teste de Conexão - Amigo Secreto*\n\nOlá *${p.nome}*, este é um teste de verificação de número. Por favor, *responda OK* para confirmar que seu número está correto no sistema.`;


        try {
            log.gravarLog(` - Testando envio de TEXTO SIMPLES para ${p.nome} (${chatId})`);
            await sendText(chatId, mensagemTeste);

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