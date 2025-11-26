import { participantService } from "../container.js";

export async function uploadParticipantes(req, res) {
    if (!req.file) throw new Error('Arquivo CSV obrigatório.');
    const msg = await participantService.importFromCSV(req.file.path, req.user.id, req.params.eventId);
    res.json({ message: msg });
}

export async function listParticipantes(req, res) {
    const lista = await participantService.list(req.params.eventId, req.user.id);
    res.json(lista);
}

export async function addParticipanteManual(req, res) {
    await participantService.addManual(req.user.id, req.params.eventId, req.body);
    res.json({ message: 'Participante adicionado.' });
}

export async function updateParticipante(req, res) {
    await participantService.update(req.params.id, req.params.eventId, req.body);
    res.json({ message: 'Atualizado.' });
}

export async function confirmarTodos(req, res) {
    const msg = await participantService.confirmAll(req.user.id, req.params.eventId);
    res.json({ message: msg });
}

export async function deleteParticipantes(req, res) {
    await participantService.deleteAll(req.params.eventId, req.user.id);
    res.json({ message: 'Lista limpa.' });
}