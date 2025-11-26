import {notificationService} from "../container.js";

export async function enviarMensagens(req, res) {
    const msg = await notificationService.sendDrawResults(req.user.id, req.params.eventId);
    res.json({ message: msg });
}

export async function enviarTeste(req, res) {
    const msg = await notificationService.sendTestNumberNotification(req.user.id, req.params.eventId);
    res.json({ message: msg });
}