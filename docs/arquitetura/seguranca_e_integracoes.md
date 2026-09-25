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

## Auditoria
Ações administrativas e sensíveis devem ser registradas em logs_auditoria.
