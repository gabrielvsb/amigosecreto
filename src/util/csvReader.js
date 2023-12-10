import fs from 'fs';
import csv from 'csv-parser';

export async function lerCSV(nomeArquivo) {
    return new Promise((resolve, reject) => {
        const lista = [];
        fs.createReadStream(nomeArquivo)
            .pipe(csv())
            .on('data', (linha) => {
                lista.push(linha);
            })
            .on('end', () => {
                console.log(' - Leitura do CSV concluída.');
                resolve(lista);
            })
            .on('error', (erro) => {
                reject(new Error(`Erro ao ler o arquivo CSV: ${erro.message}`));
            });
    });
}
