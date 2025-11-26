import { authService } from '../container.js';

export async function register(req, res) {
    try {
        const { name, email, password } = req.body || {};
        // O Service já valida e lança erro se falhar
        const tokenData = await authService.register(name, email, password);
        res.json(tokenData); // Retorna { token, user }
    } catch (e) {
        // Tratamento básico de erro: se for "já cadastrado", status 409
        const status = e.message.includes('cadastrado') ? 409 : 400;
        res.status(status).json({ error: e.message });
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body || {};
        const data = await authService.login(email, password);
        res.json(data);
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
}