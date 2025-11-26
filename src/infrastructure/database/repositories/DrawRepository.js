import prisma from '../prismaClient.js';

class DrawRepository {
    async getResults(eventId) {
        // Trazendo os nomes dos participantes através das relações
        const results = await prisma.sorteio.findMany({
            where: { event_id: parseInt(eventId) },
            include: {
                participante: { select: { nome: true } }, // JOIN automático
                amigo: { select: { nome: true } }        // JOIN automático
            }
        });

        // Mapeia para o formato simples que o front espera, se necessário
        return results.map(r => ({
            id: r.id,
            participante_nome: r.participante.nome,
            amigo_nome: r.amigo.nome,
            mensagem_enviada: r.mensagem_enviada
        }));
    }

    async getPendingMessages(eventId) {
        // Busca sorteios não enviados (0)
        return await prisma.sorteio.findMany({
            where: {
                event_id: parseInt(eventId),
                mensagem_enviada: 0
            },
            include: {
                participante: true, // Traz dados completos (telefone, nome)
                amigo: true         // Traz dados do amigo (nome)
            }
        });
    }

    async markAsSent(id) {
        return await prisma.sorteio.update({
            where: { id: parseInt(id) },
            data: { mensagem_enviada: 1 }
        });
    }

    async saveBatch(resultados, userId, eventId) {
        // Resultados vem da lógica de Sorteio: [{ pessoa, amigosecreto }, ...]
        const data = resultados.map(par => ({
            id_participante: par.pessoa.id,
            id_amigo: par.amigosecreto.id,
            user_id: userId,
            event_id: eventId,
            mensagem_enviada: 0
        }));

        // Transação: Limpa sorteio anterior desse evento e insere novos
        return await prisma.$transaction([
            prisma.sorteio.deleteMany({ where: { event_id: parseInt(eventId) } }),
            prisma.sorteio.createMany({ data })
        ]);
    }
}

export default new DrawRepository();