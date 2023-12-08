class Sorteio {
    
    constructor(lista_pessoas){
        this.lista_pessoas = lista_pessoas
        this.numeros_sorteados = [];
        this.resultado = [];
        this.maxTentativas = 3;
    }

    get mostrarResultado() {
        this.realizarSorteio();
        return this.resultado;
    }

    realizarSorteio() {
        let tentativas = 0;
        do {
            try {
                this.sorteio();
                break;
            } catch (error) {
                console.error(`Erro durante o sorteio: ${error.message}`);
                tentativas++;
                this.resultado = [];
                this.numeros_sorteados = [];
            }
        } while (tentativas < this.maxTentativas);

        if (tentativas === this.maxTentativas) {
            throw new Error('Número máximo de tentativas atingido. O sorteio falhou.');
        }
    }

    sorteio() {
        this.lista_pessoas.forEach((element, index) => {
            let pessoa_sorteada = this.sortearPosicao(this.numeros_sorteados, element, index, this.lista_pessoas);
            this.numeros_sorteados.push(this.lista_pessoas.indexOf(pessoa_sorteada));
            this.resultado.push({
                pessoa: element,
                amigosecreto: pessoa_sorteada
            });
        });
    }

    sortearPosicao(numeros_sorteados, pessoa, posicao_atual, lista_pessoas) {
        let posicao = null;
        let valido = false;
        let pessoa_sorteada = null;
        while (!valido) {
            posicao = Math.floor(Math.random() * lista_pessoas.length);
            if (!numeros_sorteados.includes(posicao) && posicao !== posicao_atual) {
                if (lista_pessoas[posicao].grupo !== pessoa.grupo) {
                    valido = true;
                    pessoa_sorteada = lista_pessoas[posicao];
                }
            }
        }
        return pessoa_sorteada;
    }
}

export default Sorteio;
