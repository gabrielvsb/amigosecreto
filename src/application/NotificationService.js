import { renderTemplate } from '../config/appConfig.js';
import { AppError } from '../util/AppError.js';

export default class NotificationService {

    constructor(messageProvider, drawRepository, participantRepository, eventService) {
        this.messageProvider = messageProvider; // WAHA
        this.drawRepository = drawRepository;
        this.participantRepository = participantRepository;
        this.eventService = eventService;
    }

    async _getTemplates(eventId, userId) {
        const evento = await this.eventService.getById(eventId, userId);
        return {
            draw: evento.msg_template_draw || '*AMIGO SECRETO*...',
            test: evento.msg_template_test || '🤖 *Teste*...'
        };
    }

    async sendDrawResults(userId, eventId) {
        const templates = await this._getTemplates(eventId, userId);
        const pendentes = await this.drawRepository.getPendingMessages(eventId);

        if (pendentes.length === 0) return 'Nenhuma mensagem pendente.';

        let enviados = 0;
        let erros = 0;

        for (const registro of pendentes) {
            const ctx = {
                participante: registro.participante.nome,
                amigo: registro.amigo.nome,
                data: new Date().toLocaleDateString('pt-BR')
            };

            const texto = renderTemplate(templates.draw, ctx);
            const telefone = registro.participante.telefone?.replace(/\D/g, '');

            if(!telefone) { erros++; continue; }
            const chatId = `${telefone}@c.us`;

            try {
                // Aqui usamos a abstração do provider
                await this.messageProvider.sendText(chatId, texto);
                await this.drawRepository.markAsSent(registro.id);
                enviados++;
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                console.error(`Erro envio ${registro.participante.nome}:`, e.message);
                erros++;
            }
        }
        return `Envio finalizado. Sucessos: ${enviados}, Erros: ${erros}.`;
    }

    async sendTestNumberNotification(userId, eventId) {
        const templates = await this._getTemplates(eventId, userId);
        const participantes = await this.participantRepository.listByEvent(eventId);

        let enviados = 0;
        let erros = 0;

        for (const participante of participantes) {
            const ctx = { nome: participante.nome, data: new Date().toLocaleDateString('pt-BR') };
            const texto = renderTemplate(templates.test, ctx);
            const telefone = participante.telefone?.replace(/\D/g, '');

            if(!telefone) { erros++; continue; }

            try {
                await this.messageProvider.sendText(`${telefone}@c.us`, texto);
                enviados++;
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                erros++;
            }
        }
        return `Teste finalizado. Enviados: ${enviados}.`;
    }
}