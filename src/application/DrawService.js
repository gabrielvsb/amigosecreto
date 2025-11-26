import SorteioDomain from '../domain/Sorteio.js';
import { AppError } from '../util/AppError.js';

export default class DrawService {

    constructor(drawRepository, participantRepository, eventService) {
        this.drawRepository = drawRepository;
        this.participantRepository = participantRepository;
        this.eventService = eventService;
    }

    async realizarSorteio(userId, eventId) {
        await this.eventService.getById(eventId, userId);

        const participantes = await this.participantRepository.listByEvent(eventId);
        if (participantes.length < 2) throw new AppError('Mínimo de 2 participantes necessários.');

        const motorSorteio = new SorteioDomain(participantes);
        const resultado = motorSorteio.retornarResultado;

        await this.drawRepository.saveBatch(resultado, userId, parseInt(eventId));
        return 'Sorteio realizado e salvo com sucesso!';
    }

    async getResult(userId, eventId) {
        await this.eventService.getById(eventId, userId);
        return await this.drawRepository.getResults(eventId);
    }
}