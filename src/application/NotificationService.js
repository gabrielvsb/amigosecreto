// src/application/NotificationService.js
import { renderTemplate } from '../config/appConfig.js';
import { sendText as sendWahaText } from '../services/wahaService.js'; // Mantemos o serviço do WAHA por enquanto
import DrawRepository from '../infrastructure/database/repositories/DrawRepository.js';
import EventService from './EventService.js';
import ParticipantRepository from "../infrastructure/database/repositories/ParticipantRepository.js";

// Defaults
const DEFAULT_TEST_TEMPLATE = '🤖 *Teste de Conexão*\n\nOlá *{{nome}}*, responda OK para confirmar.';
const DEFAULT_DRAW_TEMPLATE = '*AMIGO SECRETO*\n\nOlá *{{participante}}*, seu amigo secreto é: {{amigo}}.';

class NotificationService {

    // Método auxiliar para pegar templates
    async _getTemplates(eventId, userId) {
        const evento = await EventService.getById(eventId, userId);
        return {
            draw: evento.msg_template_draw || DEFAULT_DRAW_TEMPLATE,
            test: evento.msg_template_test || DEFAULT_TEST_TEMPLATE
        };
    }

    async sendDrawResults(userId, eventId) {
        const templates = await this._getTemplates(eventId, userId);

        // Busca sorteios pendentes de envio (mensagem_enviada = 0)
        const pendentes = await DrawRepository.getPendingMessages(eventId);

        if (pendentes.length === 0) return 'Nenhuma mensagem pendente para envio.';

        let enviados = 0;
        let erros = 0;

        for (const registro of pendentes) {
            const ctx = {
                participante: registro.participante.nome,
                amigo: registro.amigo.nome, // Graças ao include do Prisma
                data: new Date().toLocaleDateString('pt-BR')
            };

            const texto = renderTemplate(templates.draw, ctx);

            // Lógica de Telefone (Infrastructure concern, mas ok aqui por enquanto)
            const telefone = registro.participante.telefone?.replace(/\D/g, '');
            if(!telefone) { erros++; continue; }

            const chatId = `${telefone}@c.us`;

            try {
                await sendWahaText(chatId, texto);
                await DrawRepository.markAsSent(registro.id); // Prisma update
                enviados++;
                await new Promise(r => setTimeout(r, 1000)); // Delay para não bloquear o WhatsApp
            } catch (e) {
                console.error(`Erro envio ${registro.participante.nome}:`, e.message);
                erros++;
            }
        }

        return `Envio finalizado. Sucessos: ${enviados}, Erros: ${erros}.`;
    }

    async sendTestNumberNotification(userId, eventId) {
        const templates = await this._getTemplates(eventId, userId);

        const participantes = await ParticipantRepository.listByEvent(eventId)

        if (participantes.length === 0) return 'Nenhuma mensagem pendente para envio.';

        let enviados = 0;
        let erros = 0;

        for (const participante of participantes) {
            const ctx = {
                nome: participante.nome,
                data: new Date().toLocaleDateString('pt-BR')
            };

            const texto = renderTemplate(templates.test, ctx);

            const telefone = participante.telefone?.replace(/\D/g, '');
            if(!telefone) { erros++; continue; }

            const chatId = `${telefone}@c.us`;

            try {
                await sendWahaText(chatId, texto);
                await ParticipantRepository.confirmAttendance(participante.id)
                enviados++;
                await new Promise(r => setTimeout(r, 1000)); // Delay para não bloquear o WhatsApp
            } catch (e) {
                console.error(`Erro envio ${participante.nome}:`, e.message);
                erros++;
            }
        }

        return `Envio finalizado. Sucessos: ${enviados}, Erros: ${erros}.`;
    }
}

export default new NotificationService();