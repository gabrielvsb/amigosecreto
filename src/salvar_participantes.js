import * as csvReader from './util/csvReader.js';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import { formatarTelefone } from './util/telefone.js';

export async function salvarParticipantes(nome_arquivo) {
    const dadosCSV = await csvReader.lerCSV(nome_arquivo);
    if (dadosCSV.length === 0) {
        throw '\nLista vazia. Adicione participantes!';
    } else {
        const connection = await mysqlConnector.conectarMySQL();
        try {
            await dbOperations.executarTransacao(connection, async (trx) => {
                await dbOperations.resetarTabela(trx, 'sorteio');
                await dbOperations.resetarTabela(trx, 'participantes');

                for (const participante of dadosCSV) {
                    const telefoneFormatado = formatarTelefone(participante.telefone);
                    const participanteFormatado = {
                        ...participante,
                        telefone: telefoneFormatado
                    };
                    await dbOperations.inserir(trx, 'participantes', participanteFormatado);
                }
            });

            return ' - Dados salvos no banco de dados com sucesso.\n';
        } catch (error) {
            throw error;
        } finally {
            await mysqlConnector.fecharConexaoMySQL(connection);
        }
    }
}

// Nova função: salva participantes vinculados a um usuário e evento, sem reset global
export async function salvarParticipantesPorEvento(nome_arquivo, userId, eventId) {
    const dadosCSV = await csvReader.lerCSV(nome_arquivo);
    if (dadosCSV.length === 0) {
        throw '\nLista vazia. Adicione participantes!';
    }

    const connection = await mysqlConnector.conectarMySQL();
    try {
        await dbOperations.executarTransacao(connection, async (trx) => {
            // Limpa dados anteriores somente do evento do usuário
            await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE user_id = ? AND event_id = ?', [userId, eventId]);
            await dbOperations.executarConsulta(trx, 'DELETE FROM participantes WHERE user_id = ? AND event_id = ?', [userId, eventId]);

            for (const participante of dadosCSV) {
                const telefoneFormatado = formatarTelefone(participante.telefone);
                const participanteFormatado = {
                    ...participante,
                    telefone: telefoneFormatado,
                    user_id: userId,
                    event_id: eventId
                };
                await dbOperations.inserir(trx, 'participantes', participanteFormatado);
            }
        });

        return ' - Dados salvos no banco de dados com sucesso no evento selecionado.\n';
    } catch (error) {
        throw error;
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}