import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';

// Importando dos novos controllers segregados
import * as EventController from '../controllers/EventController.js';
import * as ParticipantController from '../controllers/ParticipantController.js';
import * as DrawController from '../controllers/DrawController.js';
import * as NotificationController from '../controllers/NotificationController.js';

// Configuração de upload
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const router = Router();

router.use(authMiddleware);

// --- Rotas de Eventos ---
router.get('/events', EventController.listEvents);
router.get('/events/:id', EventController.getEvent);
router.post('/events', EventController.createEvent);
router.put('/events/:id', EventController.updateEvent);
router.delete('/events/:id', EventController.deleteEvent);

// --- Rotas de Participantes ---
router.post('/events/:eventId/participantes', upload.single('arquivoCSV'), ParticipantController.uploadParticipantes);
router.get('/events/:eventId/participantes', ParticipantController.listParticipantes);
router.post('/events/:eventId/participantes/manual', ParticipantController.addParticipanteManual);
router.put('/events/:eventId/participantes/:id', ParticipantController.updateParticipante);
router.put('/events/:eventId/participantes/confirmar-todos', ParticipantController.confirmarTodos);
router.delete('/events/:eventId/participantes', ParticipantController.deleteParticipantes);

// --- Rotas de Sorteio ---
router.post('/events/:eventId/sortear', DrawController.sortearEvento);
router.get('/events/:eventId/sorteio', DrawController.listSorteio);

// --- Rotas de Notificação ---
router.post('/events/:eventId/enviar', NotificationController.enviarMensagens);
router.post('/events/:eventId/testar', NotificationController.enviarTeste);

export default router;