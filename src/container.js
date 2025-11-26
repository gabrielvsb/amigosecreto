// 1. Importar Repositórios (Implementações Concretas)
import UserRepository from './infrastructure/database/repositories/UserRepository.js';
import EventRepository from './infrastructure/database/repositories/EventRepository.js';
import ParticipantRepository from './infrastructure/database/repositories/ParticipantRepository.js';
import DrawRepository from './infrastructure/database/repositories/DrawRepository.js';

// 2. Importar Providers (Infraestrutura externa)
// Certifique-se que o arquivo abaixo existe e exporta um objeto com método sendText
import * as WahaProvider from './infrastructure/whatsapp/WahaProvider.js';

// 3. Importar Classes de Serviço
import AuthService from './application/AuthService.js';
import EventService from './application/EventService.js';
import ParticipantService from './application/ParticipantService.js';
import DrawService from './application/DrawService.js';
import NotificationService from './application/NotificationService.js';

// 4. Instanciar e Injetar Dependências (Wiring)

// AuthService precisa de UserRepository
const authService = new AuthService(UserRepository);

// EventService precisa de EventRepository
const eventService = new EventService(EventRepository);

// ParticipantService precisa de ParticipantRepo E EventService
const participantService = new ParticipantService(ParticipantRepository, eventService);

// DrawService precisa de DrawRepo, ParticipantRepo E EventService
const drawService = new DrawService(DrawRepository, ParticipantRepository, eventService);

// NotificationService precisa de WahaProvider, DrawRepo, ParticipantRepo E EventService
const notificationService = new NotificationService(
    WahaProvider,
    DrawRepository,
    ParticipantRepository,
    eventService
);

// 5. Exportar as instâncias prontas para uso
export {
    authService,
    eventService,
    participantService,
    drawService,
    notificationService
};