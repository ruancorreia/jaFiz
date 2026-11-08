# JaFiz — documentação técnica e de design

Versão do aplicativo: 1.0.0 · Revisão: 08/11/2026 · Base de código: commit `b0c7db2`.

Este guia descreve o comportamento implementado em `server.js`, `public/app.js`, `public/styles.css`, `package.json` e `render.yaml`. Exemplos usam identificadores fictícios. O roadmap contém propostas, não um contrato da API atual.

## 1. Visão geral

O JaFiz organiza tarefas recorrentes de crianças e permite que responsáveis aprovem sua realização, configurem metas mensais e registrem a entrega de recompensas em reais. O saldo começa na meta mensal e diminui conforme perdas e penalidades; não é um sistema que inicia em zero e soma dinheiro a cada clique.

Principais telas: login por perfil, painel de responsáveis, gestão de tarefas, família/administração, evolução/calendário, auditoria e área da criança. O visual segue a apresentação do projeto no [Stitch](https://stitch.google.com/projects/12263392276215178462), adaptada aos dados e recursos reais.

### Perfis

| Perfil | Recursos e permissões atuais |
| --- | --- |
| `child` | Consulta o aplicativo e marca a própria tarefa do dia, respeitando agenda e horário. A interface mostra sua área infantil. |
| `responsible` | Gerencia crianças, configurações, tarefas, aprovações, regras do celular e recompensas; pode alterar senha de crianças. |
| `admin` | Possui os recursos de responsável, consulta a lista administrativa e pode alterar a senha de qualquer perfil ou exigir nova criação no próximo acesso. |

Não há cadastro público de contas nem endpoint para criar responsáveis/admins. A base inicial fornece esses perfis. A interface não substitui as verificações de autorização da API.

## 2. Arquitetura e tecnologias

```mermaid
flowchart LR
    A[Navegador: HTML, CSS e JavaScript] -->|HTTP e JSON, cookie de sessão| B[Node.js: server.js]
    B --> C[Arquivos estáticos em public]
    B --> D{DATABASE_URL definida?}
    D -->|Não| E[data/db.json]
    D -->|Sim| F[PostgreSQL: app_state / JSONB]
```

| Componente | Tecnologia | Uso |
| --- | --- | --- |
| Servidor | Node.js >= 20, CommonJS | HTTP, API, regras de negócio e arquivos estáticos. |
| Módulos nativos | `http`, `crypto`, `fs`, `path`, `url` | Servidor, sessões, hash de senha e persistência local. |
| Banco opcional | PostgreSQL e `pg` declarado como `^8.22.0` | Armazena o estado completo em JSONB. A versão efetiva das dependências está no lockfile. |
| Frontend | HTML5 e JavaScript sem framework | Renderização no DOM, formulários, eventos, `fetch` e estado em memória. |
| Aparência | CSS3, Grid, Flexbox, media queries, SVG e emojis | Layout responsivo, ícones e gráfico. |
| Instalação | npm e `package-lock.json` | Instalação reproduzível com `npm ci`. |
| Hospedagem descrita | `render.yaml` | Configuração de serviço web Node no Render. |

Não são usados React, Vue, Express, ORM, TypeScript ou bundler. O navegador recebe diretamente os arquivos de `public`. Não existe comando de build do frontend.

### Estrutura do repositório

```text
jaFiz/
├── README.md                     entrada rápida e links
├── docs/DOCUMENTACAO.md           este guia
├── ROADMAP.md                     situação atual e próximos passos
├── server.js                      servidor, API e armazenamento
├── package.json / package-lock.json
├── render.yaml                    definição de hospedagem
├── public/
│   ├── index.html                 página e carregamento dos arquivos
│   ├── app.js                     interface e chamadas à API
│   └── styles.css                 estilos e identidade visual
├── data/db.json                   criado em execução; fora do Git
├── build_tcc_proposta.py           utilitário da proposta acadêmica
└── Proposta_Preliminar_TCC_JaFiz.docx
```

O utilitário acadêmico não é necessário para iniciar o aplicativo. Este guia não revisa o conteúdo da proposta acadêmica.

## 3. Instalação no Windows

### Pré-requisitos

Instale Git, Node.js compatível com o requisito `>=20` e npm. PostgreSQL é opcional para execução local. Confirme:

```powershell
git --version
node --version
npm --version
```

### Instalação nova

```powershell
New-Item -ItemType Directory -Force C:\repositorio | Out-Null
Set-Location C:\repositorio
# Antes, confirme que C:\repositorio\jaFiz não existe.
git clone https://github.com/ruancorreia/jaFiz.git
Set-Location C:\repositorio\jaFiz
npm ci
$env:HOST = '127.0.0.1'
npm start
```

Abra **http://127.0.0.1:3000**. Se a pasta já existir, use o checkout existente: não clone por cima dos arquivos. Antes de atualizar código, verifique `git status` e preserve suas alterações e dados.

`npm start` e `npm run dev` executam `node server.js`. Não há hot reload: após alterar `server.js`, reinicie o processo; após alterar frontend, atualize o navegador. `Ctrl+C` encerra o processo iniciado no terminal.

### Primeiro acesso e uso

Uma base nova cria Admin, Ruan, Ana Carla e Lara, além de configurações e tarefas de exemplo. Os perfis começam com `passwordHash: null`, sem senha padrão compartilhada. Selecione o perfil e crie uma senha no primeiro acesso; o mínimo implementado é quatro caracteres.

Depois, no painel de responsável/admin:

1. Confira os perfis em Família e defina a meta de cada criança.
2. Em Tarefas, cadastre título, criança, horário, ícone, confirmação e dias ativos.
3. A criança marca a realização; o responsável valida no painel.
4. Consulte evolução, calendário e auditoria.
5. Após o fechamento, aprove e registre a entrega manual da recompensa.

### Variáveis de ambiente

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP. |
| `HOST` | `0.0.0.0` | Interface de rede; use `127.0.0.1` para acesso apenas local. |
| `DATA_DIR` | pasta `data` dentro do projeto | Local de `db.json`; também pode fornecer a base inicial para PostgreSQL. |
| `DATABASE_URL` | ausente | Quando definida, seleciona PostgreSQL. |
| `NODE_ENV` | sem padrão no código | Definida como `production` no manifesto Render; não ativa políticas de segurança adicionais no servidor atual. |

Exemplo para uma porta alternativa:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '3002'
npm start
```

As variáveis persistem na sessão atual do PowerShell. Um arquivo `.env` isolado não é lido pelo projeto: não há `dotenv` nem opção `--env-file` nos scripts atuais. Configure variáveis no terminal ou na plataforma de hospedagem.

## 4. Persistência e operação

### JSON local

Sem `DATABASE_URL`, o servidor cria `DATA_DIR` e `db.json` quando necessário. A gravação usa arquivo temporário e renomeação para reduzir o risco de arquivo parcialmente gravado. As operações de API são sequenciadas dentro do processo para evitar sobrescritas simultâneas.

Para backup consistente, pare o processo e copie a pasta de dados para um local protegido. Para restaurar, pare o servidor, preserve uma cópia da base atual e restaure o arquivo escolhido antes de reiniciar. Senhas derivadas e tokens de sessão estão na base: trate o backup como privado. Não há backup automático implementado.

### PostgreSQL

Defina `DATABASE_URL` no ambiente antes de iniciar. Exemplo apenas ilustrativo:

```powershell
$env:DATABASE_URL = 'postgresql://usuario:senha@localhost:5432/jafiz'
npm start
```

O usuário do banco precisa criar e ler/escrever a tabela:

```sql
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

O estado fica na linha `key = 'main'`. Não há tabelas relacionais individuais para tarefas e usuários. Na primeira inicialização de um banco vazio, o servidor importa `DATA_DIR/db.json`, se existir; caso contrário, cria a base inicial. Se a linha já existir, ela é a fonte dos dados. Não existe sincronização contínua entre JSON e PostgreSQL.

O código desativa SSL em URLs que contêm `localhost` ou `127.0.0.1`; nas demais, usa SSL com `rejectUnauthorized: false`. A validação do certificado deve ser revista para uma operação pública mais rigorosa. Não há suporte seguro a múltiplas instâncias escrevendo simultaneamente: a fila é local ao processo e a gravação substitui todo o estado.

### Coleções do estado

| Coleção | Conteúdo principal |
| --- | --- |
| `users` | ID, nome, papel, hash de senha e criação. |
| `childrenSettings` | Meta mensal, recompensa BRL e penalidade por bloco de dez minutos. |
| `tasks` | Criança, título, dias, horário, ícone, confirmação, atividade e criação. |
| `completions` | Tarefa/dia, status, horário, aprovação e eventual penalidade. |
| `monthClosings` | Retrato do fechamento e estado da recompensa. |
| `auditLog` | Autor, ação, detalhes e instante; retenção de até 500 eventos no estado. |
| `sessions` | Token, usuário e validade. |

Campos legados como `robloxUsername`, `rewardUnits` e `weight` ainda existem por compatibilidade. A recompensa atual é BRL, e `weight` não diferencia o valor por atividade.

### Hospedagem e saúde

O arquivo `render.yaml` declara serviço Node, instalação com `npm install`, início com `npm start`, verificação em `/health`, `NODE_ENV=production` e `DATABASE_URL` a configurar externamente. A existência do manifesto não confirma que um deploy esteja ativo. Em ambientes com disco efêmero, use armazenamento persistente; o manifesto atual não declara disco para o JSON local.

`GET /health` retorna `{"ok":true,"storage":"json"}` ou `{"ok":true,"storage":"postgres"}`. É um indicador de processo/modo configurado; não realiza uma consulta de disponibilidade do banco a cada chamada.

## 5. Regras de negócio

### Meta e valor por ocorrência

```text
N = quantidade de ocorrências previstas das tarefas ativas no mês
valor por atividade = meta mensal / N, quando N > 0; senão, zero
saldo = máximo(0, meta mensal - perdas de atividades - penalidades)
recompensa em reais = saldo arredondado para duas casas decimais
```

Uma tarefa que ocorre vinte vezes representa vinte atividades no cálculo. A agenda mensal considera os dias da semana e a data de criação da tarefa. Exemplo: meta de 300 pontos e sessenta ocorrências resulta em 5 pontos por atividade; quinze pontos perdidos deixam 285 pontos e R$ 285,00. A interface arredonda valores exibidos; a divisão interna pode gerar frações.

Alterar meta, dias ou tarefas ativas recalcula os resumos dos meses consultados com a configuração atual. Não há versionamento temporal das agendas ou metas.

### Conclusão e aprovação

A criança só pode marcar a própria tarefa ativa, agendada para o dia atual, até 120 minutos após o limite. Depois do horário, a marcação registra atraso. Uma nova conclusão entra como `pending`; pendências não geram desconto enquanto aguardam validação. Nova marcação da mesma tarefa/dia retorna conflito, exceto quando o registro foi rejeitado e ainda atende às condições da API.

Tarefas ordinárias ausentes ou rejeitadas entram nas perdas após o limite; dias futuros não são descontados. A regra do celular é avaliada por responsável, reconhecida por título contendo “celular” ou ícone `moon`; sua ausência não gera perda automática. Quando reprovada, pode descontar o valor da atividade e a penalidade adicional `ceil(minutos / 10) × configuração`.

O campo `requiresChildConfirmation` informa a regra exibida na interface. O endpoint de conclusão atual não o usa como bloqueio de autorização; ele verifica o perfil da criança e a regra especial de celular. Não existe endpoint genérico dedicado para o responsável registrar diretamente qualquer tarefa comum em nome da criança.

### Recompensa e fechamento

```mermaid
stateDiagram-v2
    [*] --> pending_approval
    pending_approval --> approved: approve
    approved --> delivered: deliver
    pending_approval --> cancelled: cancel
    approved --> cancelled: cancel
```

O fechamento é verificado no acesso ao armazenamento, sem agendador separado. O mês atual pode fechar a partir do último dia, antes de terminar o dia. A API de aprovação não bloqueia reavaliações de conclusões já aprovadas/rejeitadas nem alterações referentes a meses fechados. O cancelamento é aceito para qualquer estado diferente de `delivered`, inclusive repetição sobre `cancelled`. Não há reabertura da recompensa por endpoint.

Não há Pix, carteira, integração bancária ou pagamento automático.

## 6. Referência da API HTTP

Base local: `http://127.0.0.1:3000`. Envie corpos com `Content-Type: application/json`. Respostas JSON usam UTF-8 e `Cache-Control: no-store`. A autenticação usa cookie `session`, não Bearer token.

O login fornece cookie `HttpOnly; SameSite=Lax; Path=/` válido por quatorze dias. A senha usa `scrypt` com salt e comparação em tempo constante. Logout remove a sessão atual; alteração/redefinição remove todas as sessões do usuário afetado.

### Endpoints e contratos

| Método e caminho | Acesso | Entrada | Sucesso |
| --- | --- | --- | --- |
| `GET /health` | Público | Nenhuma | `200 {ok, storage}`. |
| `GET /api/users` | Público | Nenhuma | `200 {users}`; usuários públicos com `id`, `name`, `role`, `needsPassword`, sem hash. |
| `POST /api/login` | Público | `{name, password}` ou `{name, nextPassword}` no primeiro acesso | `200 {user}` e cookie. |
| `POST /api/logout` | Sem exigência de login | Nenhuma | `200 {ok:true}` e remoção do cookie. |
| `GET /api/me` | Autenticado | Nenhuma | `200 {user}`. |
| `GET /api/app` | Autenticado | Query opcional `date=AAAA-MM-DD&month=AAAA-MM` | `200 {user, users, children, tasks, completions, auditLog, today, month}`. |
| `POST /api/tasks` | Responsável/admin | `childId`, `title`, `days`; opcionais `dueTime`, `icon`, `weight`, `scheduleType`, `requiresChildConfirmation` | `201 {task}`. |
| `PUT /api/tasks/:id` | Responsável/admin | Campos opcionais `title`, `dueTime`, `days`, `active`, `icon`, `weight`, `requiresChildConfirmation` | `200 {task}`; não altera a criança proprietária. |
| `POST /api/tasks/complete` | Criança proprietária | `{taskId, date?}` | `200 {completion}` pendente. |
| `POST /api/completions/approve` | Responsável/admin | `{ids:[], status:"approved" ou "rejected"}` | `200 {completions}` alteradas; IDs inexistentes são ignorados. |
| `POST /api/children` | Responsável/admin | `{name, monthlyPoints?, pointsPenaltyPer10Minutes?, robloxUsername?}` | `201 {child}`; senha inicialmente não criada. |
| `PUT /api/children/:id` | Responsável/admin | `{monthlyPoints?, pointsPenaltyPer10Minutes?, robloxUsername?}` | `200 {child, setting}`. Não renomeia a criança. |
| `POST /api/password` | Responsável/admin, conforme alvo/ação | `{userId, password}` para alterar; `{userId, reset:true}` para redefinir | `200 {user}`; reset exige admin. |
| `POST /api/phone-rule/report` | Responsável/admin | `{childId, date?, fulfilled, usedUntil? ou minutes?}` | `200 {completion}` aprovada/rejeitada. |
| `POST /api/rewards/:id` | Responsável/admin | `{action:"approve" ou "deliver" ou "cancel"}` | `200 {closing}`. |

`users` no retorno de `/api/app` é preenchido apenas para admin; `auditLog`, apenas para responsáveis/admin, com até trinta eventos recentes. `children`, `tasks` e `completions` não são filtrados por criança autenticada no backend atual. `summary` de cada criança inclui meta, ocorrências, valor por tarefa, perdas, saldo, recompensa, fechamento e progresso.

### Valores e validações

- Dias: `sun`, `mon`, `tue`, `wed`, `thu`, `fri`, `sat`.
- Ícones disponíveis na interface: `star`, `food`, `sparkles`, `dish`, `moon`, `poop`.
- Conclusões: `pending`, `approved`, `rejected`; `missed` também é reconhecido pelo cálculo legado.
- Criação de tarefa: título de pelo menos três caracteres, pelo menos um dia válido e horário no formato `HH:mm`. O padrão de horário é `21:00`.
- Criação de criança: nome de pelo menos dois caracteres e sem duplicata. Meta padrão de 1000 pontos. A atualização de meta rejeita números não finitos/negativos e arredonda para centésimos.
- Senha: mínimo implementado de quatro caracteres.

A validação atual é desigual entre criação e edição: editar tarefa não repete todos os controles da criação; a regex do horário valida o formato, não os intervalos de horas/minutos. Envie booleanos JSON reais, não strings como `"false"`. O corpo é limitado aproximadamente a um milhão de caracteres; excedê-lo pode encerrar a conexão. JSON inválido é tratado como erro `500` na implementação atual.

### Códigos de resposta

| Código | Uso atual |
| --- | --- |
| `200` | Consulta ou alteração concluída. |
| `201` | Tarefa/criança criada. |
| `400` | Campos, horário, senha inicial ou transição inválidos. |
| `401` | Sessão ausente/expirada ou senha incorreta. |
| `403` | Perfil/objeto/ação não permitidos. |
| `404` | Rota, usuário ou recurso não encontrado. |
| `409` | Nome duplicado ou tarefa já marcada. |
| `500` | Erro inesperado, incluindo alguns erros de parsing/armazenamento. |

Erros retornam `{ "error": "mensagem" }`. Não há paginação, versionamento `/v1`, especificação OpenAPI ou endpoints DELETE nesta versão. A inativação da tarefa usa `PUT` com `active:false`.

### Exemplos PowerShell

Execute escritas somente em uma base de testes. Obtenha IDs reais com `/api/app`; os valores `usr_EXEMPLO` e `tsk_EXEMPLO` são marcadores.

```powershell
$base = 'http://127.0.0.1:3002'
Invoke-RestMethod "$base/health"
Invoke-RestMethod "$base/api/users"

# Em base de testes nova: definir a senha inicial e guardar o cookie.
$loginBody = @{name='Admin'; nextPassword='SenhaSomenteDeTeste123!'} | ConvertTo-Json
Invoke-RestMethod "$base/api/login" -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable jafizSession

# Nos acessos seguintes, use password em vez de nextPassword.
Invoke-RestMethod "$base/api/me" -WebSession $jafizSession
$appData = Invoke-RestMethod "$base/api/app?month=2026-11" -WebSession $jafizSession
$childId = $appData.children[0].id

$taskBody = @{
  childId=$childId; title='Guardar os brinquedos'; dueTime='21:00'
  icon='star'; days=@('mon','tue','wed','thu','fri')
  requiresChildConfirmation=$true
} | ConvertTo-Json
$created = Invoke-RestMethod "$base/api/tasks" -Method Post -WebSession $jafizSession -ContentType 'application/json' -Body $taskBody

$goalBody = @{monthlyPoints=300} | ConvertTo-Json
Invoke-RestMethod "$base/api/children/$childId" -Method Put -WebSession $jafizSession -ContentType 'application/json' -Body $goalBody

Invoke-RestMethod "$base/api/logout" -Method Post -WebSession $jafizSession
```

Outros corpos de exemplo:

```json
{"taskId":"tsk_EXEMPLO","date":"2026-11-08"}
```

Use o corpo acima em `/api/tasks/complete` com sessão da criança, no dia real e dentro das regras de horário.

```json
{"ids":["cmp_EXEMPLO"],"status":"approved"}
```

```json
{"childId":"usr_EXEMPLO","date":"2026-11-08","fulfilled":false,"usedUntil":"21:25"}
```

```json
{"userId":"usr_EXEMPLO","reset":true}
```

```json
{"action":"deliver"}
```

## 7. Como testar

### Situação atual

O repositório não possui suíte automatizada versionada, script `npm test`, lint configurado ou cobertura de testes. Não confunda `node --check` com teste funcional: ele apenas valida sintaxe. Este roteiro permite reproduzir verificações sem usar os dados da família.

### Ambiente isolado

Abra outro PowerShell na raiz do projeto. Use uma pasta de dados separada e garanta que `DATABASE_URL` não aponte para produção:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$env:HOST = '127.0.0.1'
$env:PORT = '3002'
$env:DATA_DIR = Join-Path $PWD '.tmp-data-documentacao'
npm start
```

Essa pasta é ignorada pelo padrão `.tmp-data*/` do `.gitignore`. Se já existir, ela será reutilizada; para uma execução totalmente nova, escolha outro nome que comece com `.tmp-data`. Não apague nem substitua `data/db.json` para testar. Os exemplos HTTP deste guia usam a porta 3002.

### Verificação básica

Com o servidor iniciado, em outro terminal:

```powershell
node --check server.js
node --check public/app.js
Invoke-RestMethod http://127.0.0.1:3002/health
Invoke-RestMethod http://127.0.0.1:3002/api/users
```

Esperado: nenhuma mensagem de erro de sintaxe, saúde `ok:true` com modo `json` e lista de perfis sem `passwordHash`. `/api/me` sem cookie deve retornar `401`.

### Roteiro funcional e critérios

| Cenário | Procedimento | Resultado esperado |
| --- | --- | --- |
| Primeiro acesso | Criar senha no perfil de testes. | Login concluído; `needsPassword` passa a falso. |
| Persistência | Recarregar; sair/entrar; reiniciar servidor com o mesmo `DATA_DIR`. | Senha e cadastros preservados; não pedir nova criação. |
| Senha incorreta | Entrar com senha errada. | `401`, sem acesso ao painel. |
| Criar tarefa | Preencher criança, título, dias e horário. | Tarefa aparece; valor recalculado pela meta/ocorrências. |
| Editar tarefa | Alterar dias/horário, cancelar edição e reabrir. | Alteração salva quando enviada; cancelamento não persiste modificações. |
| Meta mensal | Mudar meta e comparar quantidade de ocorrências. | Valor unitário corresponde à divisão; conversão 1:1. |
| Marcar tarefa | Usar sessão da criança no dia e dentro do limite. | Registro pendente; outra criança não pode marcar. |
| Duplicidade | Reenviar a conclusão já pendente. | `409`. |
| Aprovação | Validar/rejeitar com responsável. | Status e auditoria atualizados. |
| Permissões | Usar sessão infantil para criar tarefa ou alterar meta. | `403`. |
| Celular | Registrar cumprimento e depois violação de 25 min, numa base isolada. | Cumprimento aprova; violação rejeita e calcula três blocos de penalidade. |
| Senhas no admin | Alterar/redefinir senha de perfil de testes. | Sessões desse perfil revogadas; reset solicita nova criação. |
| Recompensa | Usar fechamento existente no ambiente de testes. | Aprovar → entregar funciona; entregar diretamente pendente retorna `400`. |
| Layout | Verificar 320, 390, 768 e 1440 px nas ferramentas do navegador. | Sem rolagem horizontal da página; campos e ações utilizáveis. |
| Teclado | Navegar com Tab e setas nas abas do painel. | Foco visível; setas/Home/End mudam a aba. |

Não altere o relógio do computador de uso diário para testar fechamento. Testes automatizados futuros devem controlar a data em uma instância isolada e usar dados descartáveis. Teste também PostgreSQL separadamente: o roteiro JSON não valida o caminho do banco.

## 8. Identidade visual e componentes

### Tipografia

Pilha declarada: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. O projeto **não distribui nem importa um arquivo da fonte Inter**: ela só será usada se disponível no ambiente; caso contrário, o navegador usa a fonte de sistema. Não há dependência de fonte remota.

| Elemento | Escala principal atual |
| --- | --- |
| Título de página | 28 px desktop; 24 px mobile. |
| Título do login | 28 px desktop; 26 px mobile. |
| Títulos de painéis | Em geral 18–20 px. |
| Valores de métricas | 29 px desktop; 24 px mobile. |
| Textos de apoio | Em geral 12–14 px; alguns rótulos compactos usam 10–11 px. |
| Inputs mobile | 16 px para reduzir zoom automático em dispositivos compatíveis. |
| Pesos | 400 em apoio, 600 em controles e 650–800 em destaques. |

### Paleta

| Token CSS | Cor | Aplicação |
| --- | --- | --- |
| `--ink` | `#182131` | Texto principal, botões primários e saldo infantil. |
| `--muted` | `#69758a` | Descrições e dados secundários. |
| `--paper` | `#f6f8fb` | Fundo geral. |
| `--panel` | `#ffffff` | Cartões e barra lateral. |
| `--line` | `#e4e9f1` | Bordas e divisores. |
| `--mint` | `#35b893` | Progresso e ação de aprovação. |
| `--sky` | `#367fca` | Seleção, foco e destaques azuis. |
| `--soft` | `#eef6ff` | Superfícies leves e seleções. |
| `--good` | `#16895f` | Estado aprovado. |
| `--bad` | `#bd2f45` | Erros e rejeição. |
| `--gold` | `#d99a28` | Destaque de atenção. |
| `--rose` | `#df5d78` | Cor auxiliar declarada. |
| `--violet` | `#6f63ce` | Cor auxiliar declarada. |

Há variações diretas em CSS, como `#edf2fa` nas abas e `#eef6ff` na navegação. Nem todos os tokens auxiliares têm uso visível em todas as telas.

### Layout e elementos

- Desktop: barra lateral branca de 236 px, posição fixa por rolagem (`sticky`), identificação do usuário e área principal com cartões. As métricas ficam aderentes ao topo no desktop.
- Até 900 px: navegação inferior fixa, com ícone e rótulo para Painel, Tarefas, Família, Evolução e Sair; a área principal reserva espaço abaixo.
- Até 560 px: formulários mais compactos, métricas em duas colunas, tabelas convertidas em cartões com rótulos e métricas sem fixação para evitar ocupar a tela inteira.
- Tarefas: formulário à esquerda e listagem à direita no desktop amplo; coluna única em telas menores. Há sete controles de dia e atalhos para dias úteis/todos/limpar.
- Componentes: cartões com cantos em geral de 8 px, espaçamento recorrente de 8/12/16/20/24 px, bordas claras, sombras discretas e campos com altura mínima de 48 px.
- Ícones: SVGs locais para navegação; emojis para atividades. A marca combina o nome JaFiz e um sinal de confirmação verde em bloco escuro.
- Estados: aprovado em verde, pendente em amarelo e rejeitado em vermelho, acompanhados de texto. Seleções têm borda/fundo, além da cor.
- Área infantil: cartão escuro de saldo, progresso verde, tarefas claras e ação “Já fiz”; evolução detalhada fica recolhida.
- Acessibilidade: foco visível, rótulos de campos, abas com papéis ARIA e teclado, respeito a `prefers-reduced-motion`. Isso não representa certificação WCAG; faltam auditoria completa de contraste, leitores de tela e usabilidade.

O CSS mantém regras anteriores e um bloco final de adaptação ao Stitch; a cascata determina o estilo efetivo. Ao manter o design, verifique as últimas regras e seus breakpoints antes de alterar uma definição antiga.

## 9. Limitações conhecidas e manutenção

1. **Uma família por base:** não há `familyId` nem isolamento entre organizações. `/api/app` retorna coleções de outras crianças mesmo para sessão infantil; a interface não deve ser considerada uma barreira de privacidade.
2. **Primeiro acesso:** qualquer pessoa que alcance a tela pode tentar assumir um perfil sem senha. Falta convite/código de ativação; a senha mínima é curta, não há limite de tentativas e o cookie não inclui `Secure`.
3. **Autorização/validação:** não há proteção CSRF dedicada, validação uniforme de esquemas ou controle estrito de todas as transições. A alteração de senha não solicita a senha atual. A exibição de erros pode revelar detalhes internos.
4. **Estado único:** gravações substituem a base completa; não há bloqueio entre processos, migrações versionadas, backup automatizado ou trilha imutável de auditoria.
5. **Histórico financeiro:** alterar agenda/meta pode mudar cálculos históricos. Fechamento no último dia e alterações após fechamento exigem revisão antes de compromissos financeiros mais rigorosos.
6. **Horários:** o backend usa `America/Sao_Paulo`; o frontend e partes do calendário dependem do fuso local. Valide dispositivos/servidores com fuso diferente.
7. **Testes:** não há suíte automatizada no repositório. Prioridades: autenticação persistente, concorrência, permissões, cálculo fracionário, calendário e fechamento.

### Problemas frequentes

| Sintoma | Verificação |
| --- | --- |
| `EADDRINUSE` | A porta já está ocupada; use outra `PORT` ou encerre apenas a instância conhecida. |
| `Cannot find module 'pg'` | Execute `npm ci` na raiz. |
| Pede nova senha após reiniciar | Confira o mesmo `DATA_DIR`/`DATABASE_URL`, permissões de escrita e se o perfil sofreu reset. |
| `401` ao usar a API | Refaça login e mantenha o cookie; em PowerShell, reutilize `-WebSession`. |
| Frontend parece antigo | Atualize sem cache; reinicie se alterou o servidor. |
| Falha ao iniciar com PostgreSQL | Confira URL, acesso de rede, permissões e configuração SSL. |
| Dados desaparecem na hospedagem | Confira persistência do disco ou configuração do banco; JSON em disco efêmero não é backup. |

### Atualizar a documentação

Quando adicionar um endpoint, registre método, acesso, entrada, resposta, erros e teste correspondente. Ao alterar cálculos ou design, atualize as seções 5 e 8. Não copie senhas, cookies, `DATABASE_URL` real ou dados pessoais para exemplos. Os arquivos `data/*.json`, `.env`, `node_modules/` e `.tmp-data*/` já são ignorados pelo Git.
