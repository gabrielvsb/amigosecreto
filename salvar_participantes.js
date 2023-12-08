const nome_arquivo = process.argv[2]
import * as csvReader from './src/util/csvReader.js';
import * as mysqlConnector from './src/database/mysqlConnector.js';
import * as dbOperations from './src/database/dbOperations.js';

try {
    const dadosCSV = await csvReader.lerCSV(nome_arquivo);
    if (dadosCSV.length === 0) {
        throw '\nLista vazia. Adicione participantes!';
    } else {
        const connection = await mysqlConnector.conectarMySQL();

        try {
            await dbOperations.resetarTabela(connection, 'participantes');

            for (const participante of dadosCSV) {
                await dbOperations.inserir(connection, 'participantes', participante);
            }

            console.log('Dados salvos no banco de dados com sucesso.');
        } finally {
            await mysqlConnector.fecharConexaoMySQL(connection);
        }
    }
} catch (error) {
    console.error(error.message);
}