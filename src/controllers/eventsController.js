import EventService from '../application/EventService.js';
import ParticipantService from '../application/ParticipantService.js';
import DrawService from '../application/DrawService.js';
import NotificationService from '../application/NotificationService.js';

// --- EVENTOS ---

export async function listEvents(req, res) {
    try {
        const events = await EventService.list(req.user.id);
        res.json(events);
    } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function getEvent(req, res) {
    try {
        const event = await EventService.getById(req.params.id, req.user.id);
        res.json(event);
    } catch (e) { res.status(404).json({ error: e.message }); }
}

export async function createEvent(req, res) {
    try {
        const { name } = req.body;
        const event = await EventService.create(req.user.id, name);
        res.json({ message: 'Evento criado!', event });
    } catch (e) { res.status(400).json({ error: e.message }); }
}

export async function updateEvent(req, res) {
    try {
        const { name, msg_template_draw, msg_template_test } = req.body;
        await EventService.update(req.params.id, req.user.id, { name, msg_template_draw, msg_template_test });
        res.json({ message: 'Evento atualizado.' });
    } catch (e) { res.status(400).json({ error: e.message }); }
}

export async function deleteEvent(req, res) {
    try {
        await EventService.delete(req.params.id, req.user.id);
        res.json({ message: 'Evento excluído.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}

// --- PARTICIPANTES ---

export async function uploadParticipantes(req, res) {
    try {
        if (!req.file) throw new Error('Arquivo CSV obrigatório.');
        // O Service cuida da leitura do arquivo, limpeza do banco e inserção
        const msg = await ParticipantService.importFromCSV(req.file.path, req.user.id, req.params.eventId);
        res.json({ message: msg });
    } catch (e) { res.status(400).json({ error: e.message }); }
}

export async function listParticipantes(req, res) {
    try {
        const lista = await ParticipantService.list(req.params.eventId, req.user.id);
        res.json(lista);
    } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function addParticipanteManual(req, res) {
    try {
        await ParticipantService.addManual(req.user.id, req.params.eventId, req.body);
        res.json({ message: 'Participante adicionado.' });
    } catch (e) { res.status(400).json({ error: e.message }); }
}

export async function updateParticipante(req, res) {
    try {
        // Assume que ParticipantService tem método update genérico.
        // Se não tiver, use o Repository diretamente aqui ou adicione no Service.
        // Exemplo usando repository via Service se implementado, ou Service.update:
        await ParticipantService.update(req.params.id, req.params.eventId, req.body);
        res.json({ message: 'Atualizado.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function confirmarTodos(req, res) {
    try {
        const msg = await ParticipantService.confirmAll(req.user.id, req.params.eventId);
        res.json({ message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function deleteParticipantes(req, res) {
    try {
        await ParticipantService.deleteAll(req.params.eventId, req.user.id);
        res.json({ message: 'Lista limpa.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
}

// --- SORTEIO E ENVIO ---

export async function sortearEvento(req, res) {
    try {
        const msg = await DrawService.realizarSorteio(req.user.id, req.params.eventId);
        res.json({ message: msg });
    } catch (e) { res.status(400).json({ error: e.message }); }
}

export async function listSorteio(req, res) {
    try {
        const results = await DrawService.getResult(req.user.id, req.params.eventId);
        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function enviarMensagens(req, res) {
    try {
        const msg = await NotificationService.sendDrawResults(req.user.id, req.params.eventId);
        res.json({ message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function enviarTeste(req, res) {
    try {
        // Se implementou o método no NotificationService:
        // const msg = await NotificationService.sendTestMessages(req.user.id, req.params.eventId);
        res.json({ message: "Funcionalidade de teste deve ser migrada para o NotificationService." });
    } catch (e) { res.status(500).json({ error: e.message }); }
}