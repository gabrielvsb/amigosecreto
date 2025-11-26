import { drawService } from '../container.js';

export async function sortearEvento(req, res) {
    try {
        const msg = await drawService.realizarSorteio(req.user.id, req.params.eventId);
        res.json({ message: msg });
    } catch (e) { res.status(400).json({ error: e.message }); }
}

export async function listSorteio(req, res) {
    try {
        const results = await drawService.getResult(req.user.id, req.params.eventId);
        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
}