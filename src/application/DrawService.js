// src/application/DrawService.js
import SorteioDomain from '../Sorteio.js'; // Sua classe de domínio original
import DrawRepository from '../infrastructure/database/repositories/DrawRepository.js';
import ParticipantRepository from '../infrastructure/database/repositories/ParticipantRepository.js';
import EventService from './EventService.js';

class DrawService {

    async realizarSorteio(userId, eventId) {
        // 1. Validação
        await EventService.getById(eventId, userId);

        // 2. Busca Dados
        const participantes = await ParticipantRepository.listByEvent(eventId);
        if (participantes.length < 2) {
            throw new Error('Mínimo de 2 participantes necessários.');
        }

        // 3. Execução do Domínio (Regra de Negócio Pura)
        const motorSorteio = new SorteioDomain(participantes);
        const resultado = motorSorteio.retornarResultado;
        // ^ Se falhar, o Sorteio.js lança erro, que o controller captura.

        // 4. Persistência
        await DrawRepository.saveBatch(resultado, userId, eventId);

        return 'Sorteio realizado e salvo com sucesso!';
    }

    async getResult(userId, eventId) {
        await EventService.getById(eventId, userId);
        return await DrawRepository.getResults(eventId);
    }
}

export default new DrawService();