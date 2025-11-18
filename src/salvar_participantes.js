import * as csvReader from './util/csvReader.js';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';

function formatarTelefone(telefone) {
    if (!telefone) return null;
    let num = telefone.replace(/\D/g, ''); // Remove caracteres não numéricos
    // Se for um número válido (com DDD) e não tiver DDI '55', adiciona.
    if (num.length >= 10 && !num.startsWith('55')) {
        num = '55' + num;
    }
    return num;
}

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

                const telefoneFormatado = formatarTelefone(participante.telefone);

                // Cria um novo objeto com o telefone formatado
                const participanteFormatado = {
                    ...participante,
                    telefone: telefoneFormatado
                };

                await dbOperations.inserir(connection, 'participantes', participanteFormatado);
            }

            return ' - Dados salvos no banco de dados com sucesso.\n';
        }catch (error){
            throw error;
        } finally {
            await mysqlConnector.fecharConexaoMySQL(connection);
        }
    }
}