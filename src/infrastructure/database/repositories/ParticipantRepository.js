import prisma from '../prismaClient.js';

class ParticipantRepository {
    async listByEvent(eventId) {
        return await prisma.participant.findMany({
            where: { event_id: parseInt(eventId) }
        });
    }

    // Usado no Webhook
    async findByPhoneAndPending(telefone) {
        // Busca participantes com esse telefone e confirmação pendente (0)
        return await prisma.participant.findMany({
            where: {
                telefone: telefone,
                confirmacao_recebimento: 0
            }
        });
    }

    async confirmAttendance(ids) {
        // Atualiza vários de uma vez
        return await prisma.participant.updateMany({
            where: { id: { in: ids } },
            data: { confirmacao_recebimento: 1 }
        });
    }

    async create(data) {
        return await prisma.participant.create({ data });
    }

    async createBatch(participantes) {
        // participantes = array de objetos { nome, telefone, grupo, user_id, event_id }
        return await prisma.participant.createMany({
            data: participantes
        });
    }

    async update(id, eventId, data) {
        return await prisma.participant.updateMany({
            where: { id: parseInt(id), event_id: parseInt(eventId) },
            data
        });
    }

    async deleteByEvent(eventId) {
        return await prisma.participant.deleteMany({
            where: { event_id: parseInt(eventId) }
        });
    }
}

export default new ParticipantRepository();