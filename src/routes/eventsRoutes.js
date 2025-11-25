import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadParticipantes,
  sortearEvento,
  enviarMensagens,
  enviarTeste,
  listParticipantes,
  addParticipanteManual,
  updateParticipante,
  confirmarTodos,
  deleteParticipantes,
  listSorteio,
} from '../controllers/eventsController.js';

// Configuração de upload (garante que a pasta exista)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const router = Router();

// Middleware de auth para todas as rotas abaixo
router.use(authMiddleware);

// Eventos
router.get('/events', listEvents);
router.get('/events/:id', getEvent);
router.post('/events', createEvent);
router.put('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

// Participantes
router.post('/events/:eventId/participantes', upload.single('arquivoCSV'), uploadParticipantes);
router.get('/events/:eventId/participantes', listParticipantes);
router.post('/events/:eventId/participantes/manual', addParticipanteManual);
router.put('/events/:eventId/participantes/:id', updateParticipante);
router.put('/events/:eventId/participantes/confirmar-todos', confirmarTodos);
router.delete('/events/:eventId/participantes', deleteParticipantes);

// Sorteio e envio
router.post('/events/:eventId/sortear', sortearEvento);
router.get('/events/:eventId/sorteio', listSorteio);
router.post('/events/:eventId/enviar', enviarMensagens);
router.post('/events/:eventId/testar', enviarTeste);

export default router;
