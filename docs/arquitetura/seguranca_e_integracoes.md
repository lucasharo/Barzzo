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
- NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
- MERCADO_PAGO_ACCESS_TOKEN
- MERCADO_PAGO_CLIENT_ID
- MERCADO_PAGO_CLIENT_SECRET

Regras:
- credenciais privadas somente no backend;
- cobranças de cortes, serviços e produtos de clientes **não** passam pelo Barzzo no MVP;
- integração de pagamento de serviços ao cliente fica para uma fase futura, se o produto decidir adotá-la;
- manter domínio de assinatura separado de qualquer pagamento de atendimento.

## Auditoria
Ações administrativas e sensíveis devem ser registradas em logs_auditoria.
