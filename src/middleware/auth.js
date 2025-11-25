import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', ...options });
}

export function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token ausente.' });
  }
  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, name }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}
