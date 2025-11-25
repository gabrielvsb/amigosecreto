import * as csvReader from './util/csvReader.js';
import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import { formatarTelefone } from './util/telefone.js';

export async function salvarParticipantesPorEvento(nome_arquivo, userId, eventId) {
    const dadosCSV = await csvReader.lerCSV(nome_arquivo);
    console.log(dadosCSV);
    if (dadosCSV.length === 0) {
        throw new Error('Lista vazia. O arquivo CSV não contém dados ou está em formato inválido.');
    }

    const connection = await mysqlConnector.conectarMySQL();
    try {
        await dbOperations.executarTransacao(connection, async (trx) => {
            // Limpa dados anteriores somente do evento
            await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE user_id = ? AND event_id = ?', [userId, eventId]);
            await dbOperations.executarConsulta(trx, 'DELETE FROM participantes WHERE user_id = ? AND event_id = ?', [userId, eventId]);

            for (const linha of dadosCSV) {
                // Normaliza chaves do CSV (remove espaços e converte para minúsculo)
                // Ex: "Nome " -> "nome", "TELEFONE" -> "telefone"
                const csvLower = {};
                Object.keys(linha).forEach(k => {
                    csvLower[k.trim().toLowerCase()] = linha[k];
                });

                // Extrai apenas os campos permitidos
                const nome = csvLower['nome'] || csvLower['name'] || '';
                const telefoneRaw = csvLower['telefone'] || csvLower['phone'] || csvLower['celular'] || '';
                const grupo = csvLower['grupo'] || csvLower['group'] || null;

                if (!nome) continue; // Pula linhas sem nome

                const telefoneFormatado = formatarTelefone(telefoneRaw);

                const participanteFormatado = {
                    nome: nome,
                    telefone: telefoneFormatado, // Pode ser null se inválido
                    grupo: grupo,
                    user_id: userId,
                    event_id: eventId
                };

                await dbOperations.inserir(trx, 'participantes', participanteFormatado);
            }
        });

        return 'Importação concluída com sucesso!';
    } finally {
        await mysqlConnector.fecharConexaoMySQL(connection);
    }
}