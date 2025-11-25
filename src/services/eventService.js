import * as mysqlConnector from '../database/mysqlConnector.js';
import * as dbOperations from '../database/dbOperations.js';

// Serviço para regras comuns relacionadas a Eventos
export async function assertEventoDoUsuario(userId, eventId) {
  const connection = await mysqlConnector.conectarMySQL();
  try {
    const rows = await dbOperations.executarConsulta(
      connection,
      'SELECT id FROM events WHERE id = ? AND user_id = ?',
      [eventId, userId]
    );
    if (rows.length === 0) {
      const err = new Error('Evento não encontrado ou acesso negado.');
      err.status = 403;
      throw err;
    }
  } finally {
    await mysqlConnector.fecharConexaoMySQL(connection);
  }
}
