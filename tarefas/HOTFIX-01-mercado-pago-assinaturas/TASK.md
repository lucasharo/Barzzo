# HOTFIX-01 — Mercado Pago nas assinaturas

## Contexto

As Tasks 01–10 já foram executadas pelo Gemini em outro contexto de trabalho. A especificação original tratou Mercado Pago de forma insuficiente/tardia.

Esta hotfix existe para corrigir o MVP já implementado, sem refazer a Task 10 inteira.

## Objetivo

Adicionar ou completar a integração com Mercado Pago exclusivamente para cobrança da assinatura da barbearia no Barzzo.

## Escopo obrigatório

- assinatura mensal;
- assinatura semestral;
- criação/iniciação segura da cobrança;
- persistência dos identificadores externos necessários;
- atualização do estado interno da assinatura;
- webhook do Mercado Pago;
- idempotência;
- proteção contra eventos repetidos;
- auditoria dos eventos relevantes;
- tratamento de pagamento aprovado, pendente, recusado/cancelado e vencido quando aplicável;
- ambiente de teste/sandbox para desenvolvimento;
- configuração via variáveis de ambiente;
- nenhum segredo no frontend.

## Fora do escopo

Não implementar pagamento de:
- cortes;
- serviços;
- produtos;
- comissões de influenciadores.

Esses pagamentos continuam fora do Barzzo no MVP.

## Integração com o domínio existente

Antes de escrever código:

1. Ler toda documentação do projeto.
2. Inspecionar a implementação atual da Task 10.
3. Identificar tabelas, serviços, rotas, APIs e estados de assinatura já existentes.
4. Não duplicar estruturas se o domínio já possuir equivalentes.
5. Adaptar a integração ao modelo existente.
6. Atualizar migrations/documentação apenas quando necessário.

## Segurança

- Access Token e Client Secret apenas no backend.
- Public Key pode ser pública quando exigida pelo SDK.
- Validar autenticidade/origem dos callbacks conforme suporte oficial.
- Webhook deve ser idempotente.
- Não confiar em retorno do frontend para marcar assinatura como paga.
- Status interno deve ser atualizado por fluxo seguro no backend.
- Registrar falhas sem expor credenciais.

## Variáveis previstas

- NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
- MERCADO_PAGO_ACCESS_TOKEN
- MERCADO_PAGO_CLIENT_ID
- MERCADO_PAGO_CLIENT_SECRET

Se a implementação oficial atual exigir nomes/adicionais diferentes, o Líder Técnico deve documentar.

## Fluxo mínimo

1. Barbearia escolhe plano/período.
2. Backend cria/inicia cobrança.
3. Usuário conclui pagamento no fluxo suportado.
4. Mercado Pago notifica backend.
5. Backend valida evento.
6. Evento é processado de forma idempotente.
7. Assinatura interna é atualizada.
8. Auditoria é registrada.
9. Painel passa a refletir o estado correto.

## Regressão obrigatória

Validar que a hotfix não quebra:
- trial de 30 dias;
- benefício de +30 dias;
- planos existentes;
- suspensão/reativação;
- permissões de dono;
- Admin Barzzo;
- PWA;
- demais funcionalidades das Tasks 01–10.

## Workflow

Esta hotfix passa pelo mesmo fluxo:

PO -> Líder Técnico -> Dev -> Revisão Técnica -> QA -> PO.

Antes de implementá-la, execute o protocolo de compactação e releitura do projeto.

## Critérios de aceite

1. Uma barbearia consegue contratar plano mensal via Mercado Pago.
2. Uma barbearia consegue contratar plano semestral via Mercado Pago.
3. Nenhuma assinatura é ativada apenas por resposta do frontend.
4. Webhook repetido não duplica efeitos.
5. Status interno reflete o estado confirmado pelo provedor.
6. Segredos não aparecem no cliente/repositório.
7. Trial e benefício de retenção continuam funcionando.
8. Testes e regressão passam.
9. QA e PO aprovam.

## Resultado esperado

Mercado Pago efetivamente integrado ao MVP já desenvolvido, exclusivamente para assinatura das barbearias.
