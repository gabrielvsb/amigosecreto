import * as readline from 'readline';
import * as desenho from './src/util/desenho.js';
import cd from 'child_process';
import cores from './src/util/cores.js'
import * as sp from "./src/salvar_participantes.js";
import * as sortear from "./src/sortear.js";
import * as whatsapp from './src/enviar_mensagem.js'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

desenho.desenhar();

function exibirMenu(titulo) {
    console.log(titulo);
    console.log('1. Salvar participantes no banco de dados');
    console.log('2. Realizar sorteio');
    console.log('3. Enviar mensagens no whatsapp');
    console.log('4. Sair');
}

function processarOpcao(opcao) {
    switch (opcao) {
        case '1':
            console.log(`\n ${cores.azul}- Então vamos começar!${cores.reset}\n`);
            rl.question('Digite o nome do arquivo: ', (nome_arquivo) => {
                try {
                    sp.salvarParticipantes(nome_arquivo).then(function (retorno) {
                        console.log(`${cores.verde}${retorno}${cores.reset}`);
                        iniciarMenu(false, 'O que vamos fazer agora?');
                    });
                } catch (error) {
                    console.log(error);
                }

            });
            break;
        case '2':
            console.log('\n - Sorteando. . .');
            try {
                sortear.realizarSorteio().then((retorno) => {
                    console.log(`${cores.verde}${retorno}${cores.reset}`);
                    iniciarMenu(false, 'O que vamos fazer agora?');
                });
            } catch (error) {
                console.log(error);
            }
            break;
        case '3':
            try {
                whatsapp.enviarMensagem().then((retorno) => {
                    console.log(`${cores.verde}${retorno}${cores.reset}`);
                    iniciarMenu(false, 'O que vamos fazer agora?');
                });
            } catch (error) {
                console.log(error);
            }
            break;
        case '4':
            console.log('Saindo do programa.');
            rl.close();
            break;
        default:
            console.log(`${cores.vermelho}Opção inválida. Tente novamente.${cores.reset}\n`);
            iniciarMenu(false);
    }
}

function iniciarMenu(aberto, titulo = 'Vamos lá?') {
    if (!aberto) {
        exibirMenu(titulo)
    }
    rl.question('Digite o número da opção desejada: ', (opcao) => {
        processarOpcao(opcao);
        if (opcao === '4') {
            rl.close();
        }
    });
}

iniciarMenu(false);