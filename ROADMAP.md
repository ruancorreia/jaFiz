# Roadmap JaFiz

Revisado em 08/11/2026. A [documentação técnica](docs/DOCUMENTACAO.md) descreve instalação e comportamento atual. Os itens futuros abaixo ainda não representam recursos disponíveis.

## Já implementado

- Persistência JSON local e PostgreSQL opcional em estado JSONB.
- Senhas persistidas, sessões e administração de alteração/redefinição de senha.
- Cadastro de crianças, configurações e criação/edição/inativação de tarefas.
- Meta mensal editável e rateio igual entre ocorrências previstas.
- Conversão fixa de um ponto para um real, substituindo a recompensa em Robux.
- Marcação de tarefas pela criança e aprovação/reprovação pelo responsável.
- Regra do celular com registro e penalidade por blocos de dez minutos.
- Fechamento mensal e estados de aprovação/entrega manual de recompensa.
- Dashboard com filtros, calendário, evolução, relatório e auditoria recente.
- Interface inspirada no Stitch, com navegação inferior e adaptação mobile.
- Manifesto de serviço web no Render.

## Prioridade 1 — confiabilidade e segurança

- Isolar dados por família e restringir as coleções retornadas para crianças.
- Proteger primeiro acesso com ativação, fortalecer política de senha e limitar tentativas.
- Revisar cookie Secure, CSRF, validação de entrada e certificado PostgreSQL.
- Versionar metas/agendas e bloquear alterações incompatíveis após fechamento.
- Revisar o instante de fechamento para ocorrer após o término efetivo do mês.
- Criar backups/restauração e migrações versionadas; controlar escrita entre instâncias.
- Criar suíte automatizada de API, cálculos, permissões, persistência e frontend.

## Prioridade 2 — rotina e experiência

- Registro genérico de tarefa pelo responsável, coerente com a opção de confirmação.
- Justificativa de atraso e aprovação excepcional.
- Pausa por férias, viagem ou doença; tarefas não recorrentes.
- Edição de nomes e gestão completa de responsáveis/perfis.
- Exportação de relatórios e histórico financeiro.
- Avatares, medalhas e reforço positivo sem alterar indevidamente o cálculo financeiro.
- Auditoria de acessibilidade e usabilidade em desktop e dispositivos móveis.

## Prioridade 3 — operação e produto

- Notificações e lembretes.
- Recuperação de senha com fluxo seguro e gestão de sessões pelo próprio usuário.
- Ambientes separados de desenvolvimento, testes e produção.
- Logs estruturados, métricas, documentação OpenAPI e pipeline de validação/deploy.
- Política familiar e orientações de privacidade e entrega de recompensas.

O sistema atual não efetua pagamentos bancários. Qualquer integração futura exige um projeto próprio de segurança, consentimento e conciliação.
