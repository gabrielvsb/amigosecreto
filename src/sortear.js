import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import Sorteio from "./Sorteio.js";
import * as log from './util/log.js'

export async function realizarSorteio(){
    const connection = await mysqlConnector.conectarMySQL();
    const participantes = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes');
    if(participantes.length <= 0){
        throw  'Não há nenhum registro de participantes cadastrados no banco de dados!';
    }else{
        log.gravarLog(` - ${participantes.length} pessoas estão participando!`);
        log.gravarLog('- Sorteando. . .');
        const sorteio = new Sorteio(participantes);
        const resultado = sorteio.retornarResultado;
        await dbOperations.resetarTabela(connection, 'sorteio', false);
        for (const registro of resultado) {
            const parametro = {
                id_participante: registro.pessoa.id,
                id_amigo: registro.amigosecreto.id
            };
            await dbOperations.inserir(connection, 'sorteio', parametro);
        }
    }
    await mysqlConnector.fecharConexaoMySQL(connection);
    return ' - Sorteio realizado!\n';
}
