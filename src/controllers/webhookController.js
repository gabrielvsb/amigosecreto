import * as mysqlConnector from '../database/mysqlConnector.js';
import * as dbOperations from '../database/dbOperations.js';
import { sendText as sendWahaText } from '../services/wahaService.js';

export async function handleWebhook(req, res) {
  const payload = req.body;
  let connection;

  if (payload.event === 'message') {
    const mensagem = payload.payload;

    // Ignora mensagens enviadas por você mesmo ou sem corpo
    if (mensagem.fromMe || !mensagem.body) return res.status(200).send('OK');

    // O WAHA envia o número no formato 55xxxxxxxxxxx@c.us. Removemos o @c.us e só os dígitos.
    const telefone_db = mensagem.from.split('@')[0].replace(/\D/g, '');

    // Normaliza o texto para aceitar 'OK' (case-insensitive)
    const texto = mensagem.body.trim().toUpperCase();
    const nomeContato = mensagem._data?.notifyName || 'Desconhecido';

    console.log(`📩 NOVA MENSAGEM RECEBIDA!`);
    console.log(`   De: ${nomeContato} (Telefone DB: ${telefone_db})`);
    console.log(`   Dizendo: "${texto}"`);

    // LÓGICA DE CONFIRMAÇÃO DE TESTE: Aceita 'OK' (já normalizado para maiúsculas)
    if (texto === 'OK') {
      try {
        connection = await mysqlConnector.conectarMySQL();

        // 1. Verifica quantos participantes PENDENTES têm este número
        const querySelect =
          'SELECT COUNT(id) AS count FROM participantes WHERE telefone = ? AND confirmacao_recebimento = 0';
        const resultRows = await dbOperations.executarConsulta(connection, querySelect, [telefone_db]);

        const naoConfirmados = resultRows[0]?.count || 0;
        const chatId = mensagem.from;

        if (naoConfirmados > 0) {
          // 2. Atualiza TODOS os participantes com este telefone
          const updateResult = await dbOperations.atualizar(connection, 'participantes', { confirmacao_recebimento: 1 }, 'telefone = ?', [telefone_db]);
          const totalAtualizado = updateResult.changedRows ?? updateResult.affectedRows ?? 0;
          console.log(
            `✅ CONFIRMAÇÃO SALVA: ${totalAtualizado} registro(s) confirmado(s) para o número ${telefone_db}.`
          );

          // 3. Envia a mensagem de confirmação para o usuário
          const mensagemResposta = `*Participação confirmada!* Em breve o sorteio será realizado e você receberá ${
            totalAtualizado > 1
              ? 'os nomes dos seus amigos secretos'
              : 'o nome do seu amigo secreto'
          }.`;

          try {
            await sendWahaText(chatId, mensagemResposta);
          } catch (e) {
            console.error('Falha ao enviar mensagem de confirmação via WAHA:', e.message);
          }
        } else {
          console.log(`⚠️ NENHUM REGISTRO PENDENTE encontrado para o número: ${telefone_db}.`);
        }
      } catch (error) {
        console.error('Erro ao processar confirmação no DB:', error);
      } finally {
        if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
      }
    }
  }

  return res.status(200).send('OK');
}
