import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagemUtil from "./util/mensagem.js";
import * as log from './util/log.js';
import { sendText, isConfigured } from './services/wahaService.js';
import { getTestMessageTemplate, renderTemplate, getDrawMessageTemplate } from './config/appConfig.js';

// ... (Mantenha as funções enviarMensagem e enviarTeste existentes aqui) ...
// [CÓDIGO ANTERIOR DE enviarMensagem E enviarTeste PERMANECE IGUAL, APENAS ADICIONE O ABAIXO NO FINAL]

export async function enviarMensagem() {
    // ... (mesmo código do seu arquivo original) ...
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

    const drawTemplate = getDrawMessageTemplate();

    for (const registro of sorteio) {
        // Monta a mensagem usando o template configurável, com fallback para util
        const agora = new Date();
        const ctx = {
            participante: registro.nome_participante,
            amigo: registro.nome_amigo,
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        const renderizada = renderTemplate(drawTemplate, ctx);
        const texto = (renderizada && renderizada.trim() !== '')
            ? renderizada
            : mensagemUtil.montarMensagem(registro.nome_participante, registro.nome_amigo);
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

export async function enviarTeste() {
    // ... (mesmo código do seu arquivo original) ...
    const connection = await mysqlConnector.conectarMySQL();

    // Envia teste apenas uma vez por TELEFONE para números PENDENTES de confirmação
    // Agrupa por telefone para evitar envios duplicados quando há mais de um participante com o mesmo número
    const participantes = await dbOperations.executarConsulta(
        connection,
        'SELECT MIN(id) AS id, MIN(nome) AS nome, telefone\n         FROM participantes\n         WHERE confirmacao_recebimento = 0 AND telefone IS NOT NULL\n         GROUP BY telefone'
    );

    if (participantes.length <= 0) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        return ' - Não há participantes cadastrados para testar.';
    }

    if (!isConfigured()) {
        await mysqlConnector.fecharConexaoMySQL(connection);
        throw new Error('Configurações do WAHA ausentes.');
    }

    log.gravarLog('- Iniciando TESTE de envio de texto simples (apenas pendentes)...');

    let enviados = 0;
    let erros = 0;

    const template = getTestMessageTemplate();

    for (const p of participantes) {
        // O número já deve ter o 55 no DB (ajustado em salvar_participantes)
        let telefone = p.telefone.replace(/\D/g, '');
        const chatId = `${telefone}@c.us`;

        // Mensagem de texto simples com template parametrizado
        const agora = new Date();
        const context = {
            nome: p.nome,
            telefone: telefone,
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        const mensagemRenderizada = renderTemplate(template, context);
        // Fallback de segurança se vier vazio por algum motivo
        const mensagemTeste = (mensagemRenderizada && mensagemRenderizada.trim() !== '')
            ? mensagemRenderizada
            : `🤖 *Teste de Conexão - Amigo Secreto*\n\nOlá *${p.nome}*, este é um teste de verificação de número. Por favor, *responda OK* para confirmar que seu número está correto no sistema.`;


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


// --- NOVAS FUNÇÕES ---

export async function enviarTesteIndividual(id) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const rows = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes WHERE id = ?', [id]);
        if (rows.length === 0) throw new Error('Participante não encontrado');
        const p = rows[0];

        if (!isConfigured()) throw new Error('Configurações do WAHA ausentes.');

        const template = getTestMessageTemplate();
        let telefone = p.telefone.replace(/\D/g, '');
        const chatId = `${telefone}@c.us`;

        const agora = new Date();
        const context = {
            nome: p.nome,
            telefone: telefone,
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        const texto = renderTemplate(template, context) || `Teste Individual para ${p.nome}`;

        log.gravarLog(` - Teste Individual para ${p.nome} (${chatId})`);
        await sendText(chatId, texto);
        return `Mensagem de teste enviada para ${p.nome}!`;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

export async function enviarResultadoIndividual(id) {
    const connection = await mysqlConnector.conectarMySQL();
    try {
        // Busca os dados do sorteio para este participante
        const query = `
            SELECT s.id as id_sorteio, p.nome as nome_participante, p.telefone, a.nome as nome_amigo
            FROM sorteio s
            INNER JOIN participantes p ON s.id_participante = p.id
            INNER JOIN participantes a ON s.id_amigo = a.id
            WHERE p.id = ?
        `;
        const rows = await dbOperations.executarConsulta(connection, query, [id]);

        if (rows.length === 0) throw new Error('Sorteio não encontrado para este participante. Realize o sorteio primeiro.');

        const registro = rows[0];
        if (!isConfigured()) throw new Error('Configurações do WAHA ausentes.');

        const drawTemplate = getDrawMessageTemplate();
        const agora = new Date();
        const ctx = {
            participante: registro.nome_participante,
            amigo: registro.nome_amigo,
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        const texto = renderTemplate(drawTemplate, ctx) || mensagemUtil.montarMensagem(registro.nome_participante, registro.nome_amigo);
        const chatId = `${registro.telefone.replace(/\D/g, '')}@c.us`;

        log.gravarLog(` - Envio Individual de Resultado para ${registro.nome_participante}`);
        await sendText(chatId, texto);

        // Marca como enviada se não estava
        await dbOperations.atualizar(connection, 'sorteio', { mensagem_enviada: 1 }, 'id = ?', [registro.id_sorteio]);

        return `Resultado enviado para ${registro.nome_participante}!`;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}