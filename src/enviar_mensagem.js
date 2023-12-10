import * as mysqlConnector from './database/mysqlConnector.js';
import * as dbOperations from './database/dbOperations.js';
import * as mensagem from "./util/mensagem.js";
import * as whatsapp from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import * as log from './util/log.js'

export async function enviarMensagem() {
    const connection = await mysqlConnector.conectarMySQL();
    const sorteio = await dbOperations.executarConsulta(connection, 'select p.nome as nome_participante, p.telefone, a.nome as nome_amigo from sorteio s inner join participantes p on s.id_participante = p.id inner join participantes a on s.id_amigo = a.id where s.mensagem_enviada = 0;');
    if (sorteio.length <= 0) {
        throw 'Não há nenhum registro sorteio no banco de dados!';
    } else {
        log.gravarLog('- Enviando as mensagens. . .')

        const client = new whatsapp.Client();

        client.on('qr', (qr) => {
            log.gravarLog('QR CODE GERADO');
            qrcode.generate(qr, {small: true});
        });

        client.on('ready', async () => {
            for (const registro of sorteio) {
                log.gravarLog(` - Enviando mensagem para: ${registro.nome_participante}`);
                await client.sendMessage(`55${registro.telefone}@c.us`, mensagem.montarMensagem(registro.nome_participante, registro.nome_amigo));
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        });

        client.initialize();

        await mysqlConnector.fecharConexaoMySQL(connection);
        return '\n - Mensagens enviadas!\n';
    }

}
