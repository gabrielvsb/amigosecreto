import {eventService} from "../container.js";


export async function listEvents(req, res) {
    const events = await eventService.list(req.user.id);
    res.json(events);
}

export async function getEvent(req, res) {
    const event = await eventService.getById(req.params.id, req.user.id);
    res.json(event);
}

export async function createEvent(req, res) {
    const { name } = req.body;
    const event = await eventService.create(req.user.id, name);
    res.status(201).json({ message: 'Evento criado!', event });

}

export async function updateEvent(req, res) {
    const { name, msg_template_draw, msg_template_test } = req.body;
    await eventService.update(req.params.id, req.user.id, { name, msg_template_draw, msg_template_test });
    res.json({ message: 'Evento atualizado.' });
}

export async function deleteEvent(req, res) {
    await eventService.delete(req.params.id, req.user.id);
    res.json({ message: 'Evento excluído.' });
}