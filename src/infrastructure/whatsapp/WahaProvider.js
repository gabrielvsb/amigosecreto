import axios from 'axios';
import { AppError } from '../../util/AppError.js'; // Opcional: para padronizar erros

const WAHA_URL = process.env.WAHA_URL;
const WAHA_KEY = process.env.WAHA_API_KEY;

class WahaProvider {

    constructor() {
        this.client = axios.create({
            baseURL: WAHA_URL,
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': WAHA_KEY,
            }
        });
    }

    _isConfigured() {
        return Boolean(WAHA_URL && WAHA_KEY);
    }

    async sendText(chatId, text) {
        if (!this._isConfigured()) {
            console.warn('WAHA não configurado. Mensagem não enviada:', text);
            return;
            // Ou throw new AppError('WAHA não configurado', 500); se preferir bloquear
        }

        try {
            const body = {
                session: 'default',
                chatId,
                text,
            };
            await this.client.post('/api/sendText', body);
        } catch (error) {
            // Loga o erro mas lança AppError para o Service tratar se necessário
            const msg = error.response?.data?.error || error.message;
            throw new AppError(`Falha no envio WAHA: ${msg}`, 502); // 502 Bad Gateway
        }
    }
}

// Exporta uma instância única (Singleton) para ser usada no container.js
export default new WahaProvider();