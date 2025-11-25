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

    // Novo algoritmo: gera permutações aleatórias e valida as restrições.
    // Evita loops infinitos no nível do par pessoa->amigo.
    realizarSorteio() {
        const pessoas = this.lista_pessoas;
        const n = pessoas.length;

        if (n < 2) {
            throw new Error('São necessários pelo menos 2 participantes para realizar o sorteio.');
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

            // Se alguém caiu com ele mesmo, faz uma pequena correção por troca
            // rápida para reduzir falhas por fixpoints, antes da validação final.
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
                if (giver.id === receiver.id || giver.grupo === receiver.grupo) {
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
            throw new Error('Não foi possível encontrar uma combinação válida de sorteio após diversas tentativas. Verifique os grupos.');
        }
    }

    // Mantemos o método antigo por compatibilidade, mas não é mais usado.
    // Inclui salvaguarda para evitar laço infinito caso seja utilizado em outro lugar.
    sortearPosicao(numeros_sorteados, pessoa, id_atual, lista_pessoas) {
        let tentativas = 0;
        const max = 5000;
        while (tentativas < max) {
            tentativas++;
            const posicao = Math.floor(Math.random() * lista_pessoas.length);
            const candidato = lista_pessoas[posicao];
            if (!numeros_sorteados.includes(candidato.id) && candidato.id !== id_atual && candidato.grupo !== pessoa.grupo) {
                return candidato;
            }
        }
        throw new Error('Não foi possível selecionar uma pessoa válida dentro do limite de tentativas.');
    }
}

export default Sorteio;
