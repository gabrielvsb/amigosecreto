import { AppError } from '../util/AppError.js';

export default class EventService {
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }

    async list(userId) {
        return await this.eventRepository.listByUser(userId);
    }

    async getById(eventId, userId) {
        const event = await this.eventRepository.findById(eventId, userId);
        if (!event) throw new AppError('Evento não encontrado ou acesso negado.', 404);
        return event;
    }

    async create(userId, name) {
        if (!name || !name.trim()) throw new AppError('Nome do evento é obrigatório.');
        return await this.eventRepository.create(userId, name);
    }

    async update(eventId, userId, data) {
        await this.getById(eventId, userId);
        return await this.eventRepository.update(eventId, userId, data);
    }

    async delete(eventId, userId) {
        await this.getById(eventId, userId);
        return await this.eventRepository.delete(eventId, userId);
    }
}