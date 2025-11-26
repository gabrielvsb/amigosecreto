import ParticipantRepository from '../infrastructure/database/repositories/ParticipantRepository.js';
import { sendText } from '../services/wahaService.js';

export async function handleWebhook(req, res) {
    const payload = req.body;

    if (payload.event === 'message') {
        const mensagem = payload.payload;

        if (mensagem.fromMe || !mensagem.body) return res.status(200).send('OK');

        // Lógica simples: Se for "OK", confirma presença
        const texto = mensagem.body.trim().toUpperCase();
        if (texto === 'OK') {
            const telefone = mensagem.from.split('@')[0].replace(/\D/g, '');

            try {
                // 1. Busca pendentes (usando Prisma no Repo)
                const pendentes = await ParticipantRepository.findByPhoneAndPending(telefone);

                if (pendentes.length > 0) {
                    // 2. Atualiza todos os pendentes para confirmado
                    const ids = pendentes.map(p => p.id);
                    await ParticipantRepository.confirmAttendance(ids);

                    console.log(`✅ ${pendentes.length} confirmação(ões) para ${telefone}`);

                    // 3. Responde
                    const msgResposta = `*Participação confirmada!* Você confirmou presença em ${pendentes.length} evento(s).`;
                    await sendText(mensagem.from, msgResposta);
                }
            } catch (error) {
                console.error('Erro no webhook:', error);
            }
        }
    }

    // Sempre retorna 200 pro WAHA não ficar tentando reenviar
    return res.status(200).send('OK');
}