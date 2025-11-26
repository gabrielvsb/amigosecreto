import prisma from '../prismaClient.js';

class EventRepository {
    async listByUser(userId) {
        return await prisma.event.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });
    }

    async findById(id, userId) {
        // userId é opcional, mas recomendado para segurança
        const where = { id: parseInt(id) };
        if (userId) where.user_id = userId;

        return await prisma.event.findFirst({ where });
    }

    async create(userId, name) {
        return await prisma.event.create({
            data: {
                user_id: userId,
                name: name.trim()
            }
        });
    }

    async update(id, userId, data) {
        // data pode ser { name, msg_template_draw, ... }
        // O Prisma requer que usemos 'updateMany' se filtrarmos por userId (segurança)
        // ou verificamos antes se o evento pertence ao user.
        // Aqui usaremos updateMany para garantir a cláusula WHERE user_id
        return await prisma.event.updateMany({
            where: {
                id: parseInt(id),
                user_id: userId
            },
            data
        });
    }

    async delete(id, userId) {
        // O deleteMany é mais seguro aqui para garantir que só apaga se for do dono
        return await prisma.event.deleteMany({
            where: {
                id: parseInt(id),
                user_id: userId
            }
        });
    }
}

export default new EventRepository();