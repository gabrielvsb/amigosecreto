import fs from "fs";

export function gravarLog(mensagem) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${mensagem}\n`;

    const logFilePath = './log/events.log';

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Erro ao escrever no arquivo de log:', err);
        }
    });
}