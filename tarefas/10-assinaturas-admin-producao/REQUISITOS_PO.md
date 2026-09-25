# Requisitos do PO — TASK-10: Assinaturas, Admin e Produção

**Autor**: Product Owner (PO)  
**Data**: 25/09/2026  
**Status**: Aprovado pelo PO  

---

## 1. Visão do Produto e Modelo de Monetização

A Task 10 consolida o fechamento de ciclo do MVP do Barzzo:
1. **Monetização SaaS B2B**: Cobrança de assinaturas recorrentes das barbearias parceiras através de planos progressivos baseados na capacidade da equipe (Solo, Pro, Growth e Rede), via Mercado Pago nos ciclos mensal e semestral.
2. **Operação e Gestão Centralizada (Admin Web)**: Plataforma de backoffice completa para a equipe gestora do Barzzo auditar métricas globais (MRR, conversão de trials, agendamentos), moderar estabelecimentos e aplicar estratégias de retenção comercial.
3. **Qualidade Final de Produção**: Auditoria rigorosa de RLS, idempotência de webhooks, PWA, responsividade e selagem para homologação.

---

## 2. Histórias de Usuário

### 2.1 Gestão de Assinatura e Planos (Parceiro)
- **HU01 - Período de Avaliação (Trial de 30 Dias)**: Como novo dono de barbearia, tenho direito a 30 dias de uso completo e gratuito sem obrigatoriedade de cartão de crédito. Ao final do prazo, meus dados de clientes, serviços e histórico são rigorosamente preservados, aguardando a contratação de um plano.
- **HU02 - Escolha de Plano Conforme Equipe**: Como dono de barbearia, posso escolher o plano adequado à minha escala operacional:
  - **Solo**: 1 profissional (ideal para autônomos);
  - **Pro**: até 5 profissionais (barbearias de bairro e estúdios);
  - **Growth**: até 15 profissionais (barbearias consolidadas com alto volume);
  - **Rede**: franquias e redes multi-unidades.
- **HU03 - Contratação e Pagamento via Mercado Pago**: Como parceiro, posso optar pelo ciclo **Mensal** ou **Semestral** (com desconto atrativo) e realizar o pagamento seguro da mensalidade via Mercado Pago (Pix ou Cartão). O Barzzo não intermedeia nem cobra serviços de corte dos clientes finais no app.

### 2.2 Plataforma Administrativa (Admin Barzzo)
- **HU04 - Dashboard Executivo Global (`/admin/painel`)**: Como administrador do Barzzo, quero visualizar os indicadores vitais da plataforma: total de barbearias, ativas, em trial, assinantes ativos, faturamento recorrente mensal (MRR) e volume total de agendamentos transacionados no marketplace.
- **HU05 - Gestão e Retenção de Barbearias (`/admin/barbearias`)**: Como administrador comercial, quero poder estender o período de trial em +30 dias para barbearias em processo de negociação semestral, registrando o motivo, dias e meu usuário no histórico de benefícios sem sobrescrever os dados originais.
- **HU06 - Controle de Acessos e Usuários (`/admin/usuarios`)**: Visualização de contas, status de verificação, e-mail, telefone e papéis no sistema.
- **HU07 - Gestão de Assinaturas (`/admin/assinaturas`)**: Acompanhamento de planos contratados, ciclos de renovação e status (`trial`, `ativa`, `vencida`, `suspensa`, `cancelada`).
- **HU08 - Supervisão e Moderação (`/admin/agendamentos` e `/admin/avaliacoes`)**: Painel para auditar agendamentos suspeitos e moderar comentários ou notas inadequadas com base nas diretrizes da comunidade.
- **HU09 - Trilha de Auditoria (`/admin/logs`)**: Registro inalterável de todas as ações sensíveis realizadas por administradores (suspensões, concessões de benefícios, exclusões de teste).

---

## 3. Critérios de Aceite

1. **Preços e Planos Configuráveis**: Valores monetários e limites de profissionais devem ser armazenados na tabela `planos`, nunca hardcoded no frontend.
2. **Ciclo de Estados da Assinatura**: Transições estritas entre: `trial` -> `ativa` -> `vencida` -> `suspensa` -> `cancelada`.
3. **Preservação de Dados no Vencimento**: Estabelecimentos com status `vencida` não têm seus dados apagados; o acesso operacional é restrito à regularização financeira.
4. **Idempotência de Webhooks/Pagamentos**: Notificações de pagamento do Mercado Pago devem ser processadas com trava única contra cobranças repetidas.
5. **Auditoria Obrigatória de Benefícios**: Toda extensão de prazo ou concessão de bônus deve ser registrada em `beneficios_assinatura` e em `logs_auditoria`.
6. **Segurança Máxima RLS**:
   - Parceiros só visualizam sua própria assinatura.
   - Rotas `/admin` são restritas a usuários com papel `admin` no banco.
7. **Critério Final de Conclusão**: Com todos os testes verdes, o status do projeto no `STATUS.md` evoluirá para `MVP_PRONTO_PARA_HOMOLOGACAO`.

---

## 4. Aprovação

Requisitos formalmente aprovados pelo **Product Owner**. O documento é encaminhado para o **Líder Técnico** para elaboração do plano de arquitetura e implementação.
