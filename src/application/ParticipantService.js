import fs from 'fs';
import { formatarTelefone } from '../util/telefone.js';
import { lerCSV } from '../util/csvReader.js';
import { AppError } from '../util/AppError.js';

export default class ParticipantService {

    constructor(participantRepository, eventService) {
        this.participantRepository = participantRepository;
        this.eventService = eventService; // Injeta outro Service
    }

    async list(eventId, userId) {
        await this.eventService.getById(eventId, userId);
        return await this.participantRepository.listByEvent(eventId);
    }

    async addManual(userId, eventId, { nome, telefone, grupo }) {
        await this.eventService.getById(eventId, userId);

        const telFormatado = formatarTelefone(telefone);
        if (!telFormatado) throw new AppError('Telefone inválido.');

        return await this.participantRepository.create({
            nome,
            telefone: telFormatado,
            grupo: grupo || null,
            user_id: userId,
            event_id: parseInt(eventId)
        });
    }

    async importFromCSV(filePath, userId, eventId) {
        await this.eventService.getById(eventId, userId);

        const dadosCSV = await lerCSV(filePath);
        console.log(dadosCSV);
        if (dadosCSV.length === 0) throw new AppError('Arquivo CSV vazio ou inválido.');

        const participantesParaSalvar = [];
        for (const linha of dadosCSV) {
            const csvLower = {};
            Object.keys(linha).forEach(k => csvLower[k.trim().toLowerCase()] = linha[k]);

            const nome = csvLower['nome'] || csvLower['name'];
            const telefoneRaw = csvLower['telefone'] || csvLower['phone'] || csvLower['celular'];
            const grupo = csvLower['grupo'] || csvLower['group'];

            if (!nome) continue;

            participantesParaSalvar.push({
                nome,
                telefone: formatarTelefone(telefoneRaw),
                grupo: grupo || null,
                user_id: userId,
                event_id: parseInt(eventId)
            });
        }

        await this.participantRepository.deleteByEvent(eventId);
        if(participantesParaSalvar.length > 0) {
            await this.participantRepository.createBatch(participantesParaSalvar);
        }

        try { fs.unlinkSync(filePath); } catch {}
        return `${participantesParaSalvar.length} participantes importados com sucesso.`;
    }

    async confirmAll(userId, eventId) {
        await this.eventService.getById(eventId, userId);
        const participantes = await this.participantRepository.listByEvent(eventId);
        const ids = participantes.map(p => p.id);
        if(ids.length > 0) {
            await this.participantRepository.confirmAttendance(ids);
        }
        return 'Todos confirmados.';
    }

    async deleteAll(eventId, userId) {
        await this.eventService.getById(eventId, userId);
        return await this.participantRepository.deleteByEvent(eventId);
    }

    async update(id, eventId, data) {
        return await this.participantRepository.update(id, eventId, data);
    }
}