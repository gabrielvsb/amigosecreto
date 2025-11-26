import { AppError } from '../util/AppError.js';
import cores from '../util/cores.js'; // Reaproveitando suas cores

export function errorMiddleware(err, req, res, next) {
    // Se for um erro criado por nós (regra de negócio, 404, etc)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
    }

    // Se for erro de validação do Zod (caso implemente no futuro) ou Prisma
    if (err.code === 'P2002') { // Erro de unicidade do Prisma (ex: email duplicado)
        return res.status(409).json({ error: 'Dados duplicados (ex: email já existe).' });
    }

    // Erros inesperados (Bugs)
    console.error(`${cores.vermelho}[ERRO CRÍTICO]${cores.reset}`, err);

    return res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor.',
    });
}