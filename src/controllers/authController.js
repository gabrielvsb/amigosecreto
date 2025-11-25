import * as mysqlConnector from '../database/mysqlConnector.js';
import * as dbOperations from '../database/dbOperations.js';
import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth.js';

export async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios.' });
  let connection;
  try {
    connection = await mysqlConnector.conectarMySQL();
    const rows = await dbOperations.executarConsulta(connection, 'SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return res.status(409).json({ error: 'Email já cadastrado.' });
    const hash = await bcrypt.hash(password, 10);
    await dbOperations.inserir(connection, 'users', { name, email, password_hash: hash });
    const u = (await dbOperations.executarConsulta(connection, 'SELECT id, name, email FROM users WHERE email = ?', [email]))[0];
    res.json({ token: signToken({ id: u.id, email: u.email, name: u.name }), user: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
  }
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios.' });
  let connection;
  try {
    connection = await mysqlConnector.conectarMySQL();
    const rows = await dbOperations.executarConsulta(connection, 'SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const u = rows[0];
    res.json({ token: signToken({ id: u.id, email: u.email, name: u.name }), user: { id: u.id, name: u.name, email: u.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    if (connection) await mysqlConnector.fecharConexaoMySQL(connection);
  }
}
