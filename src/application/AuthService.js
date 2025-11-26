import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserRepository from '../infrastructure/database/repositories/UserRepository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

class AuthService {
    async register(name, email, password) {
        if (!email || !password) throw new Error('Email e senha obrigatórios.');

        const existingUser = await UserRepository.findByEmail(email);
        if (existingUser) throw new Error('Email já cadastrado.');

        const password_hash = await bcrypt.hash(password, 10);

        // Cria usuário usando o repositório
        const newUser = await UserRepository.create({ name, email, password_hash });

        return this.generateToken(newUser);
    }

    async login(email, password) {
        if (!email || !password) throw new Error('Email e senha obrigatórios.');

        const user = await UserRepository.findByEmail(email);
        if (!user) throw new Error('Credenciais inválidas.');

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) throw new Error('Credenciais inválidas.');

        return {
            token: this.generateToken(user),
            user: { id: user.id, name: user.name, email: user.email }
        };
    }

    generateToken(user) {
        return jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
    }
}

export default new AuthService();