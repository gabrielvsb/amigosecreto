import axios from 'axios';

const WAHA_URL = process.env.WAHA_URL;
const WAHA_KEY = process.env.WAHA_API_KEY;

function getAxiosConfig() {
  return {
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_KEY,
    },
  };
}

export function isConfigured() {
  return Boolean(WAHA_URL && WAHA_KEY);
}

export async function sendText(chatId, text) {
  if (!isConfigured()) {
    throw new Error('Configurações do WAHA (URL ou KEY) ausentes.');
  }
  const body = {
    session: 'default',
    chatId,
    text,
  };
  await axios.post(`${WAHA_URL}/api/sendText`, body, getAxiosConfig());
}
