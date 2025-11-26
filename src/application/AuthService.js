import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../util/AppError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export default class AuthService {

    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async register(name, email, password) {
        if (!email || !password) throw new AppError('Email e senha obrigatórios.');

        // Agora usamos this.userRepository
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) throw new AppError('Email já cadastrado.', 409);

        const password_hash = await bcrypt.hash(password, 10);
        const newUser = await this.userRepository.create({ name, email, password_hash });

        return this.generateToken(newUser);
    }

    async login(email, password) {
        if (!email || !password) throw new AppError('Email e senha obrigatórios.');

        const user = await this.userRepository.findByEmail(email);
        if (!user) throw new AppError('Credenciais inválidas.', 401);

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) throw new AppError('Credenciais inválidas.', 401);

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