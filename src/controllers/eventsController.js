import * as mysqlConnector from '../database/mysqlConnector.js';
import * as dbOperations from '../database/dbOperations.js';
import { assertEventoDoUsuario } from '../services/eventService.js';
import { formatarTelefone } from '../util/telefone.js';
import * as sp from '../salvar_participantes.js';
import * as sortear from '../sortear.js';
import * as whatsapp from '../enviar_mensagem.js';

// Eventos
export async function listEvents(req, res) {
  let connection;
  try {
    connection = await mysqlConnector.conectarMySQL();
    const eventos = await dbOperations.executarConsulta(
      connection,
      'SELECT id, name, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(eventos);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function getEvent(req, res) {
  let connection;
  try {
    const eventId = parseInt(req.params.id);
    connection = await mysqlConnector.conectarMySQL();
    const rows = await dbOperations.executarConsulta(
      connection,
      'SELECT * FROM events WHERE id = ? AND user_id = ?',
      [eventId, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function createEvent(req, res) {
  const { name } = req.body || {};
  if (!name || String(name).trim() === '') return res.status(400).json({ error: 'Nome do evento é obrigatório.' });
  let connection;
  try {
    connection = await mysqlConnector.conectarMySQL();
    await dbOperations.inserir(connection, 'events', { user_id: req.user.id, name: String(name).trim() });
    const criado = await dbOperations.executarConsulta(connection, 'SELECT * FROM events WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
    res.json({ message: 'Evento criado!', event: criado[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function updateEvent(req, res) {
  const eventId = parseInt(req.params.id);
  const { name, msg_template_draw, msg_template_test } = req.body || {};
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (msg_template_draw !== undefined) updateData.msg_template_draw = msg_template_draw;
    if (msg_template_test !== undefined) updateData.msg_template_test = msg_template_test;
    if (Object.keys(updateData).length > 0) {
      await dbOperations.atualizar(connection, 'events', updateData, 'id = ? AND user_id = ?', [eventId, req.user.id]);
    }
    res.json({ message: 'Evento atualizado com sucesso.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function deleteEvent(req, res) {
  const eventId = parseInt(req.params.id);
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    await dbOperations.executarTransacao(connection, async (trx) => {
      await dbOperations.executarConsulta(trx, 'DELETE FROM sorteio WHERE event_id = ?', [eventId]);
      await dbOperations.executarConsulta(trx, 'DELETE FROM participantes WHERE event_id = ?', [eventId]);
      await dbOperations.executarConsulta(trx, 'DELETE FROM events WHERE id = ? AND user_id = ?', [eventId, req.user.id]);
    });
    res.json({ message: 'Evento excluído.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

// Participantes: upload via CSV
export async function uploadParticipantes(req, res) {
  const eventId = parseInt(req.params.eventId);
  if (!req.file || !eventId) return res.status(400).json({ error: 'Dados inválidos.' });
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    const msg = await sp.salvarParticipantesPorEvento(req.file.path, req.user.id, eventId);
    res.json({ message: msg });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || e.toString() });
  }
}

export async function sortearEvento(req, res) {
  const eventId = parseInt(req.params.eventId);
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    const msg = await sortear.realizarSorteioPorEvento(req.user.id, eventId);
    res.json({ message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function enviarMensagens(req, res) {
  const eventId = parseInt(req.params.eventId);
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    const msg = await whatsapp.enviarMensagemPorEvento(req.user.id, eventId);
    res.json({ message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function enviarTeste(req, res) {
  const eventId = parseInt(req.params.eventId);
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    const msg = await whatsapp.enviarTestePorEvento(req.user.id, eventId);
    res.json({ message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function listParticipantes(req, res) {
  const eventId = parseInt(req.params.eventId);
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    const rows = await dbOperations.executarConsulta(connection, 'SELECT * FROM participantes WHERE user_id=? AND event_id=?', [req.user.id, eventId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function addParticipanteManual(req, res) {
  const eventId = parseInt(req.params.eventId);
  const { nome, telefone, grupo } = req.body || {};
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    const connection = await mysqlConnector.conectarMySQL();
    const tel = formatarTelefone(telefone);
    if (!tel) throw new Error('Telefone inválido');
    await dbOperations.inserir(connection, 'participantes', { nome, telefone: tel, grupo: grupo || null, user_id: req.user.id, event_id: eventId });
    await mysqlConnector.fecharConexaoMySQL(connection);
    res.json({ message: 'Adicionado.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function updateParticipante(req, res) {
  const eventId = parseInt(req.params.eventId);
  const id = parseInt(req.params.id);
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    const { confirmacao_recebimento } = req.body || {};
    if (confirmacao_recebimento !== undefined) {
      await dbOperations.atualizar(connection, 'participantes', { confirmacao_recebimento }, 'id=? AND event_id=?', [id, eventId]);
    }
    res.json({ message: 'Atualizado.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function confirmarTodos(req, res) {
  const eventId = parseInt(req.params.eventId);
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    await dbOperations.atualizar(connection, 'participantes', { confirmacao_recebimento: 1 }, 'event_id=? AND user_id=?', [eventId, req.user.id]);
    res.json({ message: 'Todos confirmados.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function deleteParticipantes(req, res) {
  const eventId = parseInt(req.params.eventId);
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    await dbOperations.executarConsulta(connection, 'DELETE FROM sorteio WHERE event_id=?', [eventId]);
    await dbOperations.executarConsulta(connection, 'DELETE FROM participantes WHERE event_id=?', [eventId]);
    res.json({ message: 'Limpo.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}

export async function listSorteio(req, res) {
  const eventId = parseInt(req.params.eventId);
  let connection;
  try {
    await assertEventoDoUsuario(req.user.id, eventId);
    connection = await mysqlConnector.conectarMySQL();
    const sql = `SELECT s.id, p1.nome as participante_nome, p2.nome as amigo_nome, s.mensagem_enviada 
                 FROM sorteio s JOIN participantes p1 ON s.id_participante=p1.id JOIN participantes p2 ON s.id_amigo=p2.id 
                 WHERE s.event_id=?`;
    const rows = await dbOperations.executarConsulta(connection, sql, [eventId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { if (connection) await mysqlConnector.fecharConexaoMySQL(connection); }
}
