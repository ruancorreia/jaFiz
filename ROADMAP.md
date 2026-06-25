# Roadmap JaFiz

## Fase 1 - Base familiar confiável

- Persistência em banco gerenciado, como PostgreSQL no Render, para substituir o JSON local quando o uso da família virar rotina.
- Migração de dados e backups automáticos, com exportação mensal da mesada e histórico de tarefas.
- Tela de edição completa de responsáveis, crianças, tarefas e combinações de calendário.
- Registro de auditoria para saber quem aprovou, reprovou, editou ou alterou senha.

## Fase 2 - Rotina e aprovação mais justas

- Justificativa de atraso enviada pela criança, com aprovação excepcional pelo responsável.
- Tarefas com peso diferente, já que algumas são mais importantes do que outras, especialmente a regra do celular.
- Bônus por sequência de dias cumpridos, sem apagar o cálculo financeiro principal.
- Pausa planejada para férias, viagens, doença ou dias sem obrigação.
- Fechamento mensal da mesada, congelando o valor final de cada mês.

## Fase 3 - Experiência da criança

- Avatar, níveis, medalhas e trilhas de progresso.
- Tela diária mais visual, separando manhã, tarde e noite.
- Feedback positivo quando a tarefa é aprovada.
- Histórico simples para a criança entender o que ganhou, perdeu e por quê.
- Missões especiais não recorrentes, como "arrumar o quarto hoje".

## Fase 4 - Dashboard dos responsáveis

- Filtros por criança, período, status e tipo de tarefa.
- Calendário mensal com tarefas cumpridas, pendentes, atrasadas e aprovadas.
- Relatórios por tarefa para identificar onde a rotina está travando.
- Aprovação rápida por dia, criança ou categoria.
- Configuração de regras financeiras por criança.

## Fase 5 - Notificações e segurança

- Lembretes antes do horário limite.
- Avisos para responsáveis quando uma tarefa for marcada ou atrasar.
- Recuperação de senha com fluxo seguro para responsáveis.
- Controle de sessão, troca de senha própria e encerramento de sessões antigas.
- Perfis com permissões mais claras, incluindo responsável principal e responsável auxiliar.

## Fase 6 - Produto hospedado

- Deploy automatizado no Render com variáveis de ambiente documentadas.
- Ambiente de produção e ambiente de testes.
- Testes automatizados de API e fluxo principal no navegador.
- Observabilidade básica: logs estruturados, erros e métricas de uso.
- Página de política familiar, explicando as regras da mesada de forma transparente.
