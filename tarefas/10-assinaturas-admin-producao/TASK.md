# TASK-10 — Assinaturas, Admin e produção

## Objetivo
Fechar monetização, operação administrativa, auditoria e qualidade final.

## Dados
planos, assinaturas, beneficios_assinatura, logs_auditoria.

## Planos
Estrutura para Solo 1, Pro até 5, Growth até 15 e Rede futura. Valores configuráveis, não hardcoded.

## Trial
30 dias sem cartão obrigatório. Não apagar dados ao vencer.

## Retenção
Admin pode conceder +30 dias condicionado ao semestral. Registrar tipo, dias, motivo, concedido_por e data sem sobrescrever histórico.

## Estados
trial, ativa, vencida, suspensa, cancelada.

## Admin
/admin/painel
/admin/barbearias
/admin/usuarios
/admin/assinaturas
/admin/agendamentos
/admin/influenciadores
/admin/avaliacoes
/admin/logs

Ações sensíveis auditadas.

## Cobrança
Integração encapsulada. Se credencial Mercado Pago ainda não estiver disponível, não inventar chave; domínio/testes podem ser preparados e bloquear apenas a integração externa indispensável.

## Revisão final
RLS, índices, migrations, Storage, segredos, performance, responsividade, PWA, ui-ux-pro-max, acessibilidade, erros, estados e regressão completa.

## Aceite
Trial/benefício/planos/admin funcionam, RLS sem vazamento, suíte e build passam, QA/PO aprovam e STATUS vira MVP_PRONTO_PARA_HOMOLOGACAO.
