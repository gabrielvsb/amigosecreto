import * as csvReader from './util/csvReader.js';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';

export async function salvarParticipantes(nome_arquivo) {
    const dadosCSV = await csvReader.lerCSV(nome_arquivo);
    if (dadosCSV.length === 0) {
        throw '\nLista vazia. Adicione participantes!';
    } else {
        const connection = await mysqlConnector.conectarMySQL();
        try {
            await dbOperations.resetarTabela(connection, 'sorteio');
            await dbOperations.resetarTabela(connection, 'participantes');

            for (const participante of dadosCSV) {
                await dbOperations.inserir(connection, 'participantes', participante);
            }

            return ' - Dados salvos no banco de dados com sucesso.\n';
        }catch (error){
            throw error;
        } finally {
            await mysqlConnector.fecharConexaoMySQL(connection);
        }
    }
}