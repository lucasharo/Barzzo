# Migração Next.js → Vite (Cliente e Parceiro)

## Contexto e motivação

Em setembro de 2026, foi decidido migrar ``apps/cliente`` e ``apps/parceiro`` de Next.js 14 para Vite + React Router. Os motivos são:

1. **Capacitor**: Next.js com SSR não funciona em WebView nativa. O ``output: export`` do Next limita Server Actions, middleware e outras funcionalidades críticas. Vite SPA é o padrão de mercado para Capacitor.
2. **Navegação lenta**: O App Router do Next.js faz round-trip ao servidor a cada troca de rota. No mobile isso é perceptível. Com Vite SPA, todas as rotas estão no bundle local — transição instantânea.
3. **SEO resolvido pela landing**: As páginas públicas de barbearia foram movidas para ``apps/landing`` (Next.js), que fica em ``barzzo.com``. O app cliente em ``app.barzzo.com`` não precisa de SSR.

## Stack final

| App | Stack | Domínio |
|-----|-------|---------|
| ``apps/landing`` | Next.js 14 | ``barzzo.com`` |
| ``apps/cliente`` | Vite + React Router v6 | ``app.barzzo.com`` |
| ``apps/parceiro`` | Vite + React Router v6 | ``parceiro.barzzo.com`` |
| ``apps/admin`` | Next.js 14 | ``admin.barzzo.com`` |

## O que muda no código

### Remoções

| Antes (Next.js) | Depois (Vite) |
|----------------|---------------|
| ``"use client"`` no topo dos arquivos | Remover — tudo é client-side |
| ``import { useRouter } from "next/navigation"`` | ``import { useNavigate } from "react-router-dom"`` |
| ``import { usePathname } from "next/navigation"`` | ``import { useLocation } from "react-router-dom"`` |
| ``import { useParams } from "next/navigation"`` | ``import { useParams } from "react-router-dom"`` |
| ``import Link from "next/link"`` | ``import { Link } from "react-router-dom"`` |
| ``export const metadata = { ... }`` | Remover — SEO na landing |
| ``app/layout.tsx`` (App Router) | ``src/App.tsx`` com ``<Routes>`` e layout component |
| ``app/[rota]/page.tsx`` | ``src/pages/[Rota].tsx`` importado no App.tsx |
| ``next.config.js`` | ``vite.config.ts`` |

### Adições

| Novo | Finalidade |
|------|-----------|
| ``vite.config.ts`` | Configuração de build, plugins, alias |
| ``index.html`` | Entry point da SPA |
| ``src/main.tsx`` | ``ReactDOM.createRoot`` + ``<BrowserRouter>`` |
| ``src/App.tsx`` | Definição de ``<Routes>`` |
| ``vite-plugin-pwa`` | PWA / service worker |
| ``RotaProtegida`` (parceiro) | Redirect para ``/entrar`` se não autenticado |

### O que NÃO muda

- Toda a lógica de negócio (queries Supabase, validações, cálculos de disponibilidade)
- Componentes de ``packages/ui``
- Tailwind CSS e design system
- Integração com Supabase Auth (já é client-side)
- Estrutura de ``packages/*``

## Mapeamento de rotas — Cliente

| App Router (Next) | React Router (Vite) |
|-------------------|---------------------|
| ``app/page.tsx`` | ``/`` |
| ``app/barbearias/page.tsx`` | ``/barbearias`` |
| ``app/barbearias/[slug]/page.tsx`` | ``/barbearias/:slug`` |
| ``app/agendamentos/page.tsx`` | ``/agendamentos`` |
| ``app/favoritos/page.tsx`` | ``/favoritos`` |
| ``app/perfil/page.tsx`` | ``/perfil`` |
| ``app/notificacoes/page.tsx`` | ``/notificacoes`` |
| ``app/entrar/page.tsx`` | ``/entrar`` |
| ``app/cadastro/page.tsx`` | ``/cadastro`` |
| ``app/recuperar-senha/page.tsx`` | ``/recuperar-senha`` |
| ``app/reservar/page.tsx`` | ``/reservar`` |
| ``app/avaliacoes/page.tsx`` | ``/avaliacoes`` |

## Mapeamento de rotas — Parceiro

| App Router (Next) | React Router (Vite) |
|-------------------|---------------------|
| ``app/page.tsx`` (redirect) | ``/`` → ``/painel`` |
| ``app/painel/`` | ``/painel`` |
| ``app/agenda/`` | ``/agenda`` |
| ``app/agendamentos/`` | ``/agendamentos`` |
| ``app/clientes/`` | ``/clientes`` |
| ``app/equipe/`` | ``/equipe`` |
| ``app/servicos/`` | ``/servicos`` |
| ``app/horarios/`` | ``/horarios`` |
| ``app/galeria/`` | ``/galeria`` |
| ``app/avaliacoes/`` | ``/avaliacoes`` |
| ``app/campanhas/`` | ``/campanhas`` |
| ``app/relatorios/`` | ``/relatorios`` |
| ``app/assinatura/`` | ``/assinatura`` |
| ``app/configuracoes/`` | ``/configuracoes`` |
| ``app/onboarding/`` | ``/onboarding`` |
| ``app/notificacoes/`` | ``/notificacoes`` |
| ``app/influenciadores/`` | ``/influenciadores`` |
| ``app/produtos/`` | ``/produtos`` |
| ``app/convite/`` | ``/convite/:token`` |
| ``app/convites/`` | ``/convites`` |

## Ordem de migração

```
1. apps/landing    → criar do zero (Next.js)
2. apps/cliente    → migrar Next → Vite
3. apps/parceiro   → migrar Next → Vite
4. apps/admin      → manter (sem mudança)
```

## Configuração padrão — vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ registerType: 'autoUpdate' }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3001, // cliente: 3001, parceiro: 3002
  },
})
```

## Configuração padrão — package.json (Vite)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "@barzzo/ui": "*",
    "@barzzo/supabase": "*",
    "@barzzo/tipos": "*",
    "@barzzo/utilitarios": "*",
    "@barzzo/validacoes": "*",
    "@barzzo/dominio": "*"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite-plugin-pwa": "^0.20.0",
    "typescript": "^5.4.5",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
```

## Configuração Capacitor (futuro)

Após o build Vite:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "Barzzo Cliente" "com.barzzo.cliente" --web-dir=dist
npx cap add android
npx cap add ios
npx cap sync
```

O ``capacitor.config.ts`` deve apontar ``webDir: 'dist'``.

## Checklist de migração por app

### Cliente
- [ ] Criar ``vite.config.ts``
- [ ] Criar ``index.html``
- [ ] Criar ``src/main.tsx``
- [ ] Criar ``src/App.tsx`` com todas as rotas
- [ ] Migrar ``src/components/navegacao-cliente.tsx`` (trocar hooks Next por React Router)
- [ ] Migrar cada página (remover ``"use client"``, trocar imports Next)
- [ ] Atualizar ``package.json``
- [ ] Remover ``next.config.js`` e arquivos Next
- [ ] Testar todas as rotas em dev
- [ ] Testar build ``vite build``

### Parceiro
- [ ] Mesmo checklist do cliente
- [ ] Criar ``RotaProtegida`` component
- [ ] Criar ``LayoutParceiro`` com ``<Outlet />``
- [ ] Verificar redirecionamento ``/`` → ``/painel``
- [ ] Testar autenticação e proteção de rotas
