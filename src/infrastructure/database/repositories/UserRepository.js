import prisma from '../prismaClient.js';

class UserRepository {
    async findByEmail(email) {
        return await prisma.user.findUnique({
            where: { email }
        });
    }

    async findById(id) {
        return await prisma.user.findUnique({
            where: { id }
        });
    }

    async create(data) {
        // data espera: { name, email, password_hash }
        return await prisma.user.create({
            data
        });
    }
}

export default new UserRepository();