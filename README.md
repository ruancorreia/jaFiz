# JaFiz

Aplicação web familiar para organizar tarefas recorrentes, validar atividades e acompanhar uma recompensa mensal. **1 ponto equivale a R$ 1,00**; a entrega da recompensa é registrada pelo responsável, sem transferência bancária automática.

## Documentação

Leia o [guia técnico completo](docs/DOCUMENTACAO.md), com instalação no Windows, configurações, testes, endpoints, regras de negócio, armazenamento, tecnologias e identidade visual. O [roadmap](ROADMAP.md) separa as entregas atuais das melhorias futuras.

## Executar localmente

Requisitos: Git, Node.js **20 ou superior** e npm. Em uma instalação nova, no PowerShell:

```powershell
New-Item -ItemType Directory -Force C:\repositorio | Out-Null
Set-Location C:\repositorio
# Execute o clone somente se a pasta jaFiz ainda não existir.
git clone https://github.com/ruancorreia/jaFiz.git
Set-Location jaFiz
npm ci
$env:HOST = '127.0.0.1'
npm start
```

Se o repositório já estiver instalado, entre na pasta existente e execute `npm ci` e `npm start`. Acesse **http://127.0.0.1:3000**. Encerre com `Ctrl+C`. `npm run dev` executa o mesmo servidor, sem recarga automática.

Sem `DATABASE_URL`, os dados são gravados em `data/db.json`. Não apague esse arquivo para atualizar a interface. Com `DATABASE_URL`, o servidor usa PostgreSQL. Variáveis em `.env` **não são carregadas automaticamente**: configure-as no ambiente do processo.

Em uma base nova, há perfis iniciais sem senha; o primeiro acesso define a senha de cada perfil. Faça essa configuração em ambiente controlado antes de disponibilizar o serviço.

## Verificações rápidas

```powershell
node --check server.js
node --check public/app.js
Invoke-RestMethod http://127.0.0.1:3000/health
```

Não existe script `npm test` nesta versão. O guia completo contém um roteiro de testes manuais, testes HTTP e instruções para usar uma base isolada.

## Tecnologias

Node.js, módulos nativos HTTP/criptografia/arquivos, JavaScript sem framework, HTML5, CSS3 e PostgreSQL opcional por meio do pacote `pg`. Não há etapa de compilação do frontend.

## Cuidados de uso

O sistema atual representa uma única família por base, sem isolamento entre organizações. Consulte as limitações de segurança e concorrência no guia antes de uma publicação aberta na internet. Dados, senhas, sessões e credenciais não devem ser enviados ao Git.
