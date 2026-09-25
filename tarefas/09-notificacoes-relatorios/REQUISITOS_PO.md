# Requisitos do PO — TASK-09: Notificações, Dashboard e Relatórios

**Autor**: Product Owner (PO)  
**Data**: 25/09/2026  
**Status**: Aprovado pelo PO  

---

## 1. Visão do Produto e Objetivos de Negócio

A Task 09 estabelece os dois pilares operacionais de comunicação e inteligência do Barzzo:
1. **Comunicação Ativa e Transparente**: Sistema de notificações in-app e push (FCM) para manter clientes e equipe da barbearia informados sobre o ciclo de vida dos agendamentos e oportunidades promocionais, sem spam e sem uso de canais de e-mail ou WhatsApp.
2. **Gestão Operacional e Inteligência de Negócio**: Dashboard operacional em tempo real para a rotina diária da barbearia e módulo de relatórios analíticos (geral, por profissional e de marketing) com métricas financeiras, taxa de ocupação e comparativo de tempo previsto versus realizado.

---

## 2. Histórias de Usuário

### 2.1 Notificações e Push (FCM)
- **HU01 - Central de Notificações In-App**: Como cliente ou profissional, quero acessar uma central `/notificacoes` onde posso visualizar todos os meus alertas organizados cronologicamente, marcá-los como lidos e identificar o tipo da mensagem (confirmação, cancelamento, lembrete, etc.).
- **HU02 - Dispositivos e Push Notification**: Como usuário com um ou mais dispositivos móveis ou navegadores, quero que meus tokens FCM sejam registrados e mantidos ativos para receber notificações push instantâneas.
- **HU03 - Preferências Promocionais**: Como cliente, quero ter a opção de desativar o recebimento de notificações de campanhas promocionais, mantendo ativas apenas as notificações transacionais essenciais da minha reserva.
- **HU04 - Lembrete Anti-Duplicação**: Como cliente, devo receber lembrete oportuno antes do meu atendimento, garantindo que o sistema nunca envie lembretes duplicados para a mesma reserva.

### 2.2 Dashboard da Barbearia (`/painel`)
- **HU05 - Resumo Executivo do Dia**: Como dono ou gerente, quero abrir o painel da barbearia e ver imediatamente os números de hoje:
  - Próximos clientes aguardando;
  - Atendimentos em andamento e concluídos;
  - Cancelamentos e faltas (no-show);
  - Faturamento realizado e receita estimada restante;
  - Clientes novos atendidos hoje.
- **HU06 - Próximos Atendimentos em Tempo Real**: Lista dinâmica com os próximos clientes, profissional escalado, serviço, horário e botões de ação rápida (iniciar, finalizar ou ver detalhes).

### 2.3 Relatórios Analíticos (`/relatorios`)
- **HU07 - Filtros Temporais Flexíveis**: Como gestor, quero filtrar relatórios por: hoje, últimos 7 dias, últimos 30 dias ou intervalo de datas customizado, além de poder filtrar por profissional específico.
- **HU08 - Visão Geral do Estabelecimento**:
  - Total de agendamentos realizados e taxa de conclusão;
  - Faturamento total do período;
  - Ticket médio por atendimento;
  - Índice e quantidade de cancelamentos e no-shows.
- **HU09 - Visão e Desempenho por Profissional**:
  - Quantidade de cortes/serviços realizados;
  - Faturamento gerado pelo profissional;
  - Ticket médio individual;
  - Taxa de ocupação da jornada de trabalho;
  - Duração prevista vs. Duração real (comparativo de pontualidade/eficiência);
  - Serviços mais demandados de cada profissional.
- **HU10 - Relatório de Marketing**:
  - Cupons mais aplicados e volume de desconto concedido;
  - Conversões originadas por links de influenciadores parceiros;
  - Comissões pendentes e liquidadas.
- **HU11 - Visão Restrita do Profissional**: Como profissional (não dono/gerente), tenho acesso aos meus próprios relatórios individuais, sendo resguardado o sigilo sobre dados financeiros consolidados de outros profissionais e da barbearia como um todo.

---

## 3. Critérios de Aceite

1. **Multi-Dispositivo**: Suporte a múltiplos registros em `dispositivos` vinculados ao mesmo `usuario_id`, com inativação graciosa caso um token FCM se torne inválido.
2. **Tipos de Eventos Notificáveis**: Confirmação, cancelamento, lembrete, reagendamento, promoção e comunicado do sistema.
3. **Idempotência de Lembretes**: Disparo de lembrete com chave única ou flag `lembrete_enviado` garantindo entrega única.
4. **Respeito a Preferências**: Notificações promocionais (`tipo = 'promocao'`) só devem ser disparadas para clientes com permissão ativa.
5. **Relatórios Confiáveis**: O cálculo de faturamento e ticket médio deve considerar apenas agendamentos efetivamente `concluido`. Cancelamentos e no-shows devem compor as métricas de perda/fricção.
6. **Desempenho Real x Previsto**: Cálculo matemático baseado em `duracao_total_minutos` versus diferença em minutos entre `inicio_real` e `fim_real`.
7. **Isolamento Multi-Tenant e Hierarquia de Papéis**:
   - Donos e gerentes visualizam todas as métricas da barbearia.
   - Profissionais visualizam apenas seus próprios dados operacionais.
   - Clientes só visualizam suas próprias notificações.

---

## 4. Aprovação

Requisitos formalmente aprovados pelo **Product Owner**. O documento é encaminhado para o **Líder Técnico** para elaboração do plano de arquitetura e implementação.
