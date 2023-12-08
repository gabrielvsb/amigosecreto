import Sorteio from './src/Sorteio.js';
import * as csvReader from './src/util/csvReader.js';
import * as mysqlConnector from './src/database/mysqlConnector.js';
import * as dbOperations from './src/database/dbOperations.js';
import * as readline from 'readline';
import * as desenho from './src/util/desenho.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

desenho.desenhar();

rl.question('Digite o nome do arquivo: ', (nomeArquivo) => {
    (async () => {
        try {
            const dadosCSV = await csvReader.lerCSV(nomeArquivo);

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
    })();
    rl.close();
});

