# Amigo Secreto Manager

Um gerenciador de Amigo Secreto com Node.js, Express, MySQL e integração com WhatsApp via WAHA. Permite importar participantes via CSV, realizar o sorteio e enviar automaticamente as mensagens com o resultado para cada participante.

### Principais recursos
- Upload de participantes em massa via CSV.
- Sorteio automático dos pares (sem repetições) com persistência em banco.
- Envio de mensagens pelo WhatsApp usando WAHA (WhatsApp HTTP API).
- Painel web simples (frontend estático em /public) para executar o fluxo.
- Webhook para receber confirmações dos participantes (resposta “OK”).
- Logs de execução em log/events.log.

### Arquitetura
- API: Node.js + Express (src/) agora organizada em padrão MVC + princípios SOLID
  - controllers/: orquestram a entrada HTTP e chamam serviços (ex.: authController, eventsController)
  - routes/: definem as rotas e conectam aos controllers (ex.: authRoutes, eventsRoutes, webhookRoutes)
  - services/: regras de negócio e integrações (ex.: eventService, wahaService)
  - database/: acesso a dados (mysqlConnector, dbOperations)
  - util/ e config/: utilitários e configuração
- Banco: MySQL (init.sql e tabelas participantes/sorteio/events/users)
- WhatsApp: WAHA (devlikeapro/waha)
- Orquestração opcional: Docker Compose

### Pré‑requisitos
- Opção A (local):
  - Node.js 18+
  - MySQL 5.7+ (ou compatível) com um banco criado
- Opção B (containers):
  - Docker e Docker Compose

Configuração de ambiente (.env)
Crie um arquivo .env na raiz (há um exemplo no repositório) com as chaves abaixo:

Banco de Dados
- DB_HOST: host do MySQL (ex.: localhost ou db no Docker)
- DB_PORT: porta do MySQL (padrão 3306)
- DB_USER: usuário do MySQL (ex.: root)
- DB_PASS: senha do MySQL
- DB_NAME: nome do banco (ex.: db_amigo_secreto)

WAHA (WhatsApp)
- WAHA_URL: URL do serviço WAHA (ex.: http://localhost:3000 ou http://waha:3000 no Docker)
- WAHA_API_KEY: chave de API do WAHA
- WAHA_DASHBOARD_USERNAME: usuário do dashboard do WAHA
- WAHA_DASHBOARD_PASSWORD: senha do dashboard do WAHA

API
- PORT: porta em que a API Node escutará (padrão 3000)

### Instalação e execução

#### Opção A — Usando Docker Compose (recomendado)
1) Ajuste o arquivo .env (já existe um exemplo funcional para compose).
2) Suba os serviços:
   docker-compose up -d

Serviços expostos (host):
- API Node: http://localhost:3001 (mapeia a porta interna 3000)
- WAHA: http://localhost:3000 (dashboard/QR e API do WAHA)
- MySQL: localhost:3307 (mapeia a 3306 interna)

Na primeira execução, o MySQL aplicará o init.sql automaticamente (cria DB e tabelas).

#### Opção B — Execução local (sem Docker)
1) Ajuste o .env para apontar para seu MySQL local e WAHA acessível.
2) Instale as dependências:
   npm install
3) Inicialize as tabelas executando init.sql no seu MySQL (se ainda não existir).
4) Inicie a API:
   npm start

Por padrão, a API ficará em http://localhost:3000 (e servirá o frontend da pasta public).

### Fluxo de uso (passo a passo)
1) Inicie o WAHA e acesse o dashboard em http://localhost:3000/dashboard para escanear o QR code com o WhatsApp.
2) Acesse o frontend do projeto:
   - Docker: http://localhost:3001
   - Local: http://localhost:3000
3) Faça o upload do CSV de participantes.
4) Execute o sorteio.
5) Envie as mensagens aos participantes.

Formato do CSV
O arquivo CSV deve conter pelo menos as colunas:
- nome (obrigatório)
- telefone (obrigatório)
- grupo (opcional)

Observações sobre telefone:
- O sistema normaliza o telefone removendo caracteres não numéricos e adiciona o DDI 55 (Brasil) quando não presente e o número tem ao menos 10 dígitos.
- Exemplo de valores aceitos: 11999999999, (11) 99999-9999, 5511999999999


Endpoints principais (REST)
- Autenticação
  - POST /api/auth/register → cria usuário e retorna token JWT
  - POST /api/auth/login → autentica e retorna token JWT

- Webhook WAHA
  - POST /api/webhook → recebe mensagens; ao receber "OK", marca confirmacao_recebimento = 1 para o telefone

- Gestão de eventos (JWT obrigatório)
  - GET  /api/user/events → lista eventos do usuário
  - GET  /api/user/events/:id → detalhes do evento
  - POST /api/user/events → cria evento { name }
  - PUT  /api/user/events/:id → atualiza { name?, msg_template_draw?, msg_template_test? }
  - DELETE /api/user/events/:id → remove evento e dados relacionados

- Participantes (por evento)
  - POST /api/user/events/:eventId/participantes → upload CSV (campo arquivoCSV)
  - GET  /api/user/events/:eventId/participantes → lista participantes
  - POST /api/user/events/:eventId/participantes/manual → adiciona { nome, telefone, grupo? }
  - PUT  /api/user/events/:eventId/participantes/:id → atualiza flags (ex.: { confirmacao_recebimento })
  - PUT  /api/user/events/:eventId/participantes/confirmar-todos → marca todos como confirmados
  - DELETE /api/user/events/:eventId/participantes → limpa participantes e sorteio do evento

- Sorteio e envio (por evento)
  - POST /api/user/events/:eventId/sortear → executa sorteio
  - GET  /api/user/events/:eventId/sorteio → lista resultado do sorteio
  - POST /api/user/events/:eventId/enviar → envia mensagens do sorteio pendentes
  - POST /api/user/events/:eventId/testar → envia mensagem de teste para números com pendência de confirmação

Frontend
O frontend estático (Bootstrap) é servido pela própria API:
- Local: http://localhost:3000
- Docker: http://localhost:3001
No card “Envio”, há um link para o painel do WAHA (dashboard) para leitura do QR.

#### Logs
- As ações registram mensagens em log/events.log. Em caso de problemas, consulte este arquivo.

#### Customizando as mensagens
- Mensagem OFICIAL de sorteio (com o nome do amigo):
  - No frontend (página principal), use o card "Mensagem do Sorteio (Template Oficial)" para editar o texto enviado no botão "Enviar Mensagens".
  - Placeholders disponíveis: {{participante}}, {{amigo}}, {{data}}, {{hora}}.
  - Alternativamente, via API:
    - GET /api/config/draw-message → retorna { template, placeholders }
    - PUT /api/config/draw-message com body { template: "..." } → salva o template
  - Observação: existe um fallback para o texto legado em src/util/mensagem.js caso o template esteja vazio.
- Mensagem de TESTE (disparo de verificação):
  - No frontend (página principal), use o card "Mensagem de Teste (Template)" para editar o texto do teste com variáveis.
  - Placeholders disponíveis: {{nome}}, {{telefone}}, {{data}}, {{hora}}.
  - Alternativamente, via API:
    - GET /api/config/test-message → retorna { template, placeholders }
    - PUT /api/config/test-message com body { template: "..." } → salva o template

#### Banco de dados
- Script de criação de tabelas: init.sql
- Tabelas:
  - participantes: id, nome, telefone, grupo, confirmacao_recebimento
  - sorteio: id, id_participante, id_amigo, mensagem_enviada

#### Segurança e cuidados
- Proteja a variável WAHA_API_KEY (não versione sua chave real).
- Não compartilhe o arquivo .env em repositórios públicos.
- Valide o CSV antes de subir em produção.

#### Solução de problemas
- Não envia mensagens:
  - Verifique se WAHA_URL e WAHA_API_KEY estão definidos e o dashboard mostra a sessão conectada.
  - Confira o log em log/events.log.
  - Garanta que existam registros em sorteio com mensagem_enviada = 0.
- Erros de banco de dados:
  - Confirme os dados do .env (DB_HOST, DB_USER, etc.).
  - Se estiver usando Docker, o host do DB é db e a porta exposta no host é 3307.
- Webhook não atualiza confirmações:
  - Verifique se o WAHA está configurado com WHATSAPP_HOOK_URL para http://api:3000/api/webhook no docker-compose.yml.

Licença
ISC (conforme package.json).
