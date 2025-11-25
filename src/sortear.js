import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import Sorteio from "./Sorteio.js";
import * as log from './util/log.js'

export async function realizarSorteio(){
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const participantes = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes');
        if(participantes.length <= 0){
            throw  'Não há nenhum registro de participantes cadastrados no banco de dados!';
        }else{
            log.gravarLog(` - ${participantes.length} pessoas estão participando!`);
            log.gravarLog('- Sorteando. . .');
            const sorteio = new Sorteio(participantes);
            const resultado = sorteio.retornarResultado;

            await dbOperations.executarTransacao(connection, async (trx) => {
                await dbOperations.resetarTabela(trx, 'sorteio', false);
                for (const registro of resultado) {
                    const parametro = {
                        id_participante: registro.pessoa.id,
                        id_amigo: registro.amigosecreto.id
                    };
                    await dbOperations.inserir(trx, 'sorteio', parametro);
                }
            });
            log.gravarLog(` - Sorteio finalizado. Registros salvos: ${resultado.length}.`);
        }
        return ' - Sorteio realizado!\n';
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}

// Novo: realiza sorteio por usuário e evento, salvando vínculos
export async function realizarSorteioPorEvento(userId, eventId){
    if(!userId || !eventId){
        throw 'Parâmetros inválidos: userId e eventId são obrigatórios.';
    }
    const connection = await mysqlConnector.conectarMySQL();
    try {
        const participantes = await dbOperations.executarConsulta(
            connection,
            'SELECT * FROM participantes WHERE user_id = ? AND event_id = ? ORDER BY id ASC',
            [userId, eventId]
        );
        if(participantes.length <= 1){
            throw 'São necessários pelo menos 2 participantes neste evento para realizar o sorteio!';
        }

        log.gravarLog(` - (${userId}/${eventId}) ${participantes.length} pessoas estão participando!`);
        log.gravarLog('- Sorteando. . .');
        const sorteio = new Sorteio(participantes);
        const resultado = sorteio.retornarResultado;

        await dbOperations.executarTransacao(connection, async (trx) => {
            // Limpa somente os resultados deste evento do usuário
            await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE user_id = ? AND event_id = ?', [userId, eventId]);
            for (const registro of resultado) {
                const parametro = {
                    id_participante: registro.pessoa.id,
                    id_amigo: registro.amigosecreto.id,
                    user_id: userId,
                    event_id: eventId
                };
                await dbOperations.inserir(trx, 'sorteio', parametro);
            }
        });
        log.gravarLog(` - Sorteio finalizado (${userId}/${eventId}). Registros salvos: ${resultado.length}.`);
        return ' - Sorteio realizado para o evento!\n';
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}
