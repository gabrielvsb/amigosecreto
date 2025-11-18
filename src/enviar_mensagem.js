import axios from 'axios';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagemUtil from "./util/mensagem.js";
import * as log from './util/log.js';

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_KEY = process.env.WAHA_API_KEY; // Lê a chave do docker-compose

export async function enviarMensagem() {
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