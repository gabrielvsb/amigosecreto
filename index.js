import Sorteio from './src/Sorteio.js';

import * as readline from 'readline';
import * as desenho from './src/util/desenho.js';
import cd from 'child_process';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

desenho.desenhar();

// rl.question('Digite o nome do arquivo: ', (nomeArquivo) => {
//     (async () => {
//         try {
//             const dadosCSV = await csvReader.lerCSV(nomeArquivo);
//
//             if (dadosCSV.length === 0) {
//                 throw '\nLista vazia. Adicione participantes!';
//             } else {
//                 const connection = await mysqlConnector.conectarMySQL();
//
//                 try {
//                     await dbOperations.resetarTabela(connection, 'participantes');
//
//                     for (const participante of dadosCSV) {
//                         await dbOperations.inserir(connection, 'participantes', participante);
//                     }
//
//                     console.log('Dados salvos no banco de dados com sucesso.');
//                 } finally {
//                     await mysqlConnector.fecharConexaoMySQL(connection);
//                 }
//             }
//         } catch (error) {
//             console.error(error.message);
//         }
//     })();
//     rl.close();
// });

function exibirMenu() {
    console.clear();
    console.log('Vamos lá?');
    console.log('1. Começar');
    console.log('2. Sair');
}

function exibirMenuSorteio() {
    console.log('Menu sorteio:');
    console.log('1. Sortear');
    console.log('2. Sair');
}

function processarOpcao(opcao) {
    switch (opcao) {
        case '1':
            console.log('\nEntão vamos começar!\n');
            rl.question('Digite o nome do arquivo: ', (nome_arquivo) =>{
                cd.exec(`node salvar_participantes.js ${nome_arquivo}`, (error, stdout, stderr) =>{
                    if(error){
                        console.error(`Erro ao executar salvar.js: ${error}`);
                    }else{
                        console.log(stdout);
                        iniciarMenuSorteio();
                    }
                });
            });
            break;
        case '2':
            console.log('Saindo do programa.');
            rl.close();
            break;
        default:
            console.log('Opção inválida. Tente novamente.');
    }
}

function processarOpcaoSorteio(opcao) {
    switch (opcao) {
        case '1':
            console.log('Opção 1.');
            break;
        case '2':
            console.log('Saindo do menu de sorteio:');
            rl.close();
            exibirMenu();
            iniciarMenu();
            break;
        default:
            console.log('Opção inválida. Tente novamente.');
    }
}

function iniciarMenu() {
    rl.question('Digite o número da opção desejada: ', (opcao) => {
        processarOpcao(opcao);
        if (opcao !== '2') {
            iniciarMenu();
        }
    });
}

function iniciarMenuSorteio(){
    exibirMenuSorteio();
    rl.question('O que vamos fazer agora?: ', (opcao) => {
        processarOpcaoSorteio(opcao);
        if (opcao !== '2') {
            iniciarMenuSorteio();
        }
    });
}
exibirMenu();
iniciarMenu();