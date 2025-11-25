import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import Sorteio from "./Sorteio.js";
import * as log from './util/log.js';

// DEPRECIADO: Não use esta função, pois ela mistura todos os usuários.
// Mantida apenas se houver algum script legado CLI usando.
export async function realizarSorteio(){
    throw new Error("Função obsoleta. Use realizarSorteioPorEvento.");
}

// CORRETO: Sorteio vinculado ao Usuário e Evento
export async function realizarSorteioPorEvento(userId, eventId){
    if(!userId || !eventId){
        throw 'Erro de segurança: userId e eventId são obrigatórios.';
    }
    const connection = await mysqlConnector.conectarMySQL();
    try {
        // SELECT filtrado por USER e EVENT
        const participantes = await dbOperations.executarConsulta(
            connection,
            'SELECT * FROM participantes WHERE user_id = ? AND event_id = ? ORDER BY id ASC',
            [userId, eventId]
        );

        if(participantes.length < 2){
            throw 'São necessários pelo menos 2 participantes neste evento para realizar o sorteio!';
        }

        log.gravarLog(` - (User: ${userId}, Event: ${eventId}) Iniciando sorteio com ${participantes.length} participantes.`);

        const sorteio = new Sorteio(participantes);
        const resultado = sorteio.retornarResultado;

        await dbOperations.executarTransacao(connection, async (trx) => {
            // DELETE filtrado: apaga apenas o sorteio deste evento
            await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE user_id = ? AND event_id = ?', [userId, eventId]);

            for (const registro of resultado) {
                const parametro = {
                    id_participante: registro.pessoa.id,
                    id_amigo: registro.amigosecreto.id,
                    user_id: userId,
                    event_id: eventId,
                    mensagem_enviada: 0 // Garante que reinicia o status de envio
                };
                await dbOperations.inserir(trx, 'sorteio', parametro);
            }
        });

        log.gravarLog(` - Sorteio finalizado com sucesso.`);
        return 'Sorteio realizado e salvo com sucesso!';
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}