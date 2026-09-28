# Segurança e integrações

## RLS
Obrigatório em tabelas expostas. Políticas devem checar propriedade/vínculo, não apenas authenticated. Testar tenant A contra B em toda entidade privada.

## Autorização
Não usar metadata editável pelo usuário para permissão. Papéis vêm de registros controlados.

## Storage
Supabase Storage. Políticas por usuário/tenant. Imagens: validar, orientar, redimensionar, comprimir e só então enviar. Substituição deve evitar referência quebrada.

## Chaves
Frontend: somente públicas/publishable.
Backend: segredos apenas no ambiente seguro.
Nunca versionar .env.local.

## Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA
SUPABASE_CHAVE_SECRETA

## Firebase FCM
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY

Firebase Storage não será usado.

## Mercado Pago

Mercado Pago faz parte do MVP **somente para cobrança da assinatura da barbearia**.

Credenciais previstas:
- NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY (ou VITE_MERCADO_PAGO_PUBLIC_KEY no parceiro)
- MERCADO_PAGO_ACCESS_TOKEN
- MERCADO_PAGO_CLIENT_ID
- MERCADO_PAGO_CLIENT_SECRET

Regras de Segurança e Tokenização:
- **Tokenização Segura no Frontend:** Dados sensíveis do cartão (número, código CVV/CVC) são enviados diretamente do navegador para a API do Mercado Pago via SDK (`createCardToken`), gerando um token efêmero de transação (`card_token`).
- **Isolamento de Dados Sensíveis:** O backend do Barzzo e o banco de dados PostgreSQL **nunca** recebem, processam ou armazenam números completos de cartão ou códigos de segurança.
- **Armazenamento de Cartões Salvos:** A tabela `public.cartoes_salvos` registra apenas dados não-sensíveis autorizados: `token_cartao` (identificador criptográfico), `ultimos_digitos`, `bandeira`, `mes_expiracao`, `ano_expiracao`, `titular_nome` e `barbearia_id`.
- **Controle de Acesso (RLS):** Cartões salvos são protegidos por RLS para acesso exclusivo do dono/gerente da barbearia proprietária.
- **Processamento de Assinaturas:** Credenciais privadas do Mercado Pago permanecem unicamente nas Edge Functions / backend e nunca são expostas aos clientes ou parceiros.
- **Webhooks Idempotentes e Assíncronos:**
  - **Endpoint:** `/api/webhooks/mercadopago` (Serverless Function em `apps/parceiro/api/webhooks/mercadopago.js`).
  - **Finalidade:** Receber notificações de pagamentos assíncronos (Pix), confirmações de primeira cobrança de cartão e renovações periódicas automáticas de assinaturas ou cancelamentos.
  - **Eventos Monitorados:** `payment` (pagamentos/pix) e `subscription_preapproval` / `preapproval` (assinaturas e renovações).
  - **Garantia de Idempotência:** Cada evento recebido é verificado e registrado em `public.eventos_webhook_mercadopago` por seu identificador único (`evento_id`). Retentativas automáticas do gateway são respondidas com 200 OK sem reexecutar operações de banco.
  - **Validação de Autenticidade:** O endpoint consulta a API oficial do Mercado Pago usando o `MERCADO_PAGO_ACCESS_TOKEN` para checar o status legítimo do pagamento antes de alterar qualquer estado no sistema.
  - **Ativação Segura:** Dispara a RPC atômica `processar_confirmacao_pagamento_assinatura` atualizando `assinaturas` e `barbearias` sem risco de duplicidade de faturamento.
  - **Configuração de Produção:** Cadastrar a URL `https://<dominio-parceiro>/api/webhooks/mercadopago` no Painel de Desenvolvedores do Mercado Pago selecionando os tópicos de Pagamentos e Assinaturas.

Regras de Negócio de Assinaturas:
- **Bloqueio de Regressão de Plano (Downgrade):** É terminantemente proibido o downgrade de plano durante a vigência de um ciclo ativo já faturado. Caso o parceiro deseje alterar para um plano menor ou cancelar, a mudança só se efetiva após o término do período pago. Upgrades têm cobrança imediata e aplicação instantânea.
- **Desconto em Ciclo/Plano Maior:** Ciclos maiores (semestral e anual) contemplam descontos percentuais automáticos sobre a mensalidade equivalente, além de bônus de trial estendido (+30 dias no plano semestral), incentivando a retenção e diminuindo atrito financeiro.
- Cobranças de cortes, serviços e produtos de clientes **não** passam pelo Barzzo no MVP;
- Manter o domínio de assinatura completamente separado de qualquer pagamento de atendimento operacional.

## Auditoria
Ações administrativas e sensíveis devem ser registradas em logs_auditoria.
