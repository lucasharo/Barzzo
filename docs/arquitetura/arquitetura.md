# Arquitetura

## Stack
Frontend: Next.js, React, TypeScript, Tailwind, shadcn/ui.
Dados/backend: Supabase PostgreSQL, Auth, Storage, RPC/funções/Edge Functions quando adequado.
Push: Firebase Cloud Messaging.
Hospedagem inicial: Vercel.
Geo: PostGIS.
Mobile: Capacitor.

## Princípio
Next.js cuida da experiência web/SEO. Regras críticas devem viver em backend/banco seguro, evitando dependência exclusiva de Server Actions e permitindo clientes web e Capacitor.

## Separação obrigatória

O Barzzo é um **monorepo com três aplicações independentes**:

```text
apps/
├── cliente/
├── parceiro/
└── admin/
```

- **Cliente**: marketplace público + área autenticada do cliente.
- **Parceiro**: dono, gerente e profissional; autenticação obrigatória.
- **Admin**: operação interna do Barzzo; web.

Código compartilhado deve ficar em `packages/*`. As aplicações não devem importar telas entre si.

A especificação completa e obrigatória está em:
`docs/arquitetura/separacao_aplicacoes.md`.

## Regra pública do Cliente

Pesquisa, perfil da barbearia, serviços, profissionais, consulta de disponibilidade, seleção de horário e resumo da reserva devem funcionar **sem login**.

Login/cadastro ocorre somente antes da confirmação definitiva; depois da autenticação, a seleção deve ser restaurada e a disponibilidade revalidada.

## Backend

As três aplicações compartilham o mesmo Supabase, domínio de dados e autenticação. Separação de frontend não substitui RLS nem autorização no backend.

## Mobile

Devem existir futuramente dois pacotes mobile independentes:
- Barzzo Cliente;
- Barzzo Parceiro.

Admin permanece web.

## PWA
Mobile-first. Offline total não é requisito; reserva exige conexão. Abstrair câmera, geolocalização e push para adaptação ao Capacitor.

## UX
Toda tela nova passa por ui-ux-pro-max antes de implementar e no QA.
