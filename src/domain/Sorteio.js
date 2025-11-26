import { AppError } from '../util/AppError.js';

class Sorteio {

    constructor(lista_pessoas){
        this.lista_pessoas = lista_pessoas;
        this.numeros_sorteados = [];
        this.resultado = [];
        // Aumenta o número de tentativas para encontrar uma permutação válida
        this.maxTentativas = 1000;
    }

    get retornarResultado() {
        this.realizarSorteio();
        return this.resultado;
    }

    // Algoritmo que gera permutações aleatórias e valida as restrições
    realizarSorteio() {
        const pessoas = this.lista_pessoas;
        const n = pessoas.length;

        if (n < 2) {
            throw new AppError('São necessários pelo menos 2 participantes para realizar o sorteio.', 400);
        }

        const indices = Array.from({ length: n }, (_, i) => i);

        let tentativas = 0;
        let sucesso = false;

        while (tentativas < this.maxTentativas && !sucesso) {
            tentativas++;
            // Embaralha os índices (Fisher-Yates)
            const perm = [...indices];
            for (let i = n - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [perm[i], perm[j]] = [perm[j], perm[i]];
            }

            // Se alguém caiu com ele mesmo, faz uma pequena correção por troca rápida
            for (let i = 0; i < n; i++) {
                if (perm[i] === i) {
                    const swapWith = (i + 1) % n;
                    [perm[i], perm[swapWith]] = [perm[swapWith], perm[i]];
                }
            }

            // Valida restrições: não pode ser a mesma pessoa e nem do mesmo grupo
            let valido = true;
            for (let i = 0; i < n; i++) {
                const giver = pessoas[i];
                const receiver = pessoas[perm[i]];
                if (giver.id === receiver.id || (giver.grupo && receiver.grupo && giver.grupo === receiver.grupo)) {
                    valido = false;
                    break;
                }
            }

            if (valido) {
                // Monta o resultado
                this.resultado = [];
                this.numeros_sorteados = [];
                for (let i = 0; i < n; i++) {
                    const giver = pessoas[i];
                    const receiver = pessoas[perm[i]];
                    this.numeros_sorteados.push(receiver.id);
                    this.resultado.push({ pessoa: giver, amigosecreto: receiver });
                }
                sucesso = true;
            }
        }

        if (!sucesso) {
            throw new AppError('Não foi possível encontrar uma combinação válida de sorteio após diversas tentativas. Verifique se os grupos não estão travando o sorteio.', 422);
        }
    }
}

export default Sorteio;