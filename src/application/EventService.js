// src/application/EventService.js
import EventRepository from '../infrastructure/database/repositories/EventRepository.js';

class EventService {
    async list(userId) {
        return await EventRepository.listByUser(userId);
    }

    async getById(eventId, userId) {
        const event = await EventRepository.findById(eventId, userId);
        if (!event) throw new Error('Evento não encontrado ou acesso negado.');
        return event;
    }

    async create(userId, name) {
        if (!name || !name.trim()) throw new Error('Nome do evento é obrigatório.');
        return await EventRepository.create(userId, name);
    }

    async update(eventId, userId, data) {
        // Garante que o evento existe e é do usuário antes de atualizar
        await this.getById(eventId, userId);
        return await EventRepository.update(eventId, userId, data);
    }

    async delete(eventId, userId) {
        await this.getById(eventId, userId);
        return await EventRepository.delete(eventId, userId);
    }
}

export default new EventService();