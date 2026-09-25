# Arquitetura

## Stack
Frontend: Next.js, React, TypeScript, Tailwind, shadcn/ui.
Dados/backend: Supabase PostgreSQL, Auth, Storage, RPC/funções/Edge Functions quando adequado.
Push: Firebase Cloud Messaging.
Hospedagem inicial: Vercel.
Geo: PostGIS.
Futuro mobile: Capacitor.

## Princípio
Next.js cuida da experiência web/SEO. Regras críticas devem viver em backend/banco seguro, evitando dependência exclusiva de Server Actions e permitindo cliente Capacitor no futuro.

## Estrutura sugerida
app/
componentes/
modulos/
bibliotecas/
tipos/
validacoes/
utilitarios/
supabase/migrations/
supabase/functions/

## PWA
Mobile-first. Offline total não é requisito; reserva exige conexão. Abstrair câmera, geolocalização e push para adaptação futura ao Capacitor.

## UX
Toda tela nova passa por ux-pro-max antes de implementar e no QA.
