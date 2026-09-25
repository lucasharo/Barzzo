# TASK-01 — Fundação, autenticação e usuários

## Objetivo
Base executável e autenticação/perfil seguros.

## Escopo
Next.js/React/TypeScript, Tailwind, shadcn/ui, PWA básica, Supabase, migrations, usuarios, Auth, cadastro por e-mail/senha, login, logout, recuperação, sessão, perfil, telefone, foto, redimensionamento, Storage, RLS, layouts e base de testes. Google/Apple não bloqueiam.

## Rotas
/entrar, /cadastro, /recuperar-senha, /perfil.

## Dados
usuarios: id, nome, email, telefone, foto_url, criado_em, atualizado_em; vínculo com auth.users.

## Foto
Validar, redimensionar (referência 800x800), comprimir, upload Supabase Storage e política do proprietário.

## UX
ux-pro-max obrigatório. Formulários mobile-first, labels/foco, erros claros, feedback de upload e ações.

## Segurança
Usuário só altera próprio perfil. Nenhuma secret no cliente. Não usar metadata editável para autorização.

## Testes
Cadastro, duplicidade, login válido/inválido, recuperação, persistência, logout, edição, foto, acesso ao perfil alheio, responsividade, build/lint/typecheck.

## Aceite
Conta/sessão/perfil completos; imagem redimensionada; RLS comprovada; PWA base pronta; QA e PO aprovam.
