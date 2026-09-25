# Plano Técnico — TASK-02: Barbearias, Onboarding e Equipe

## 1. Visão Geral da Arquitetura

A TASK-02 introduz o modelo multi-tenant do Barzzo, permitindo a criação e gestão de barbearias, onboarding do dono, convites e gestão de equipe (dono, gerente e profissional).

### Regras Centrais
1. O usuário que cria a barbearia torna-se automaticamente seu **dono** (`papel = 'dono'`).
2. Um usuário pode ser dono, gerente ou profissional de múltiplas barbearias (`membros_barbearia`).
3. O profissional pode ser cadastrado pelo dono **mesmo antes de possuir uma conta** (`usuario_id = NULL`), e é vinculado à conta Supabase ao aceitar o convite.
4. O trial concedido na criação é de **30 dias** corridos.
5. Isolamento Multi-Tenant estrito via RLS: nenhuma informação privada da barbearia A pode ser acessada ou alterada por membros da barbearia B.

---

## 2. Estrutura do Banco de Dados e Migrations

Arquivo: `supabase/migrations/20260925000001_criar_barbearias_e_equipe.sql`

### Tabelas
- `public.barbearias`:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `nome text NOT NULL`
  - `slug text NOT NULL UNIQUE`
  - `telefone text`, `email text`, `documento text`
  - `endereco text`, `bairro text`, `cidade text`, `estado text`, `cep text`
  - `latitude numeric(10, 7)`, `longitude numeric(10, 7)`
  - `logo_url text`
  - `status_assinatura text DEFAULT 'trial' NOT NULL` (trial, ativo, inadimplente, cancelado)
  - `trial_inicio timestamptz DEFAULT now() NOT NULL`
  - `trial_fim timestamptz DEFAULT (now() + interval '30 days') NOT NULL`
  - `onboarding_concluido boolean DEFAULT false NOT NULL`
  - `ativa boolean DEFAULT true NOT NULL`
  - `criado_em timestamptz`, `atualizado_em timestamptz`

- `public.membros_barbearia`:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
  - `usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL`
  - `papel text NOT NULL CHECK (papel IN ('dono', 'gerente', 'profissional'))`
  - `ativo boolean DEFAULT true NOT NULL`
  - `UNIQUE(barbearia_id, usuario_id)`

- `public.profissionais`:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
  - `usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL`
  - `nome text NOT NULL`, `email text`, `telefone text`, `foto_url text`, `bio text`
  - `ativo boolean DEFAULT true NOT NULL`

- `public.convites_profissionais`:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
  - `profissional_id uuid REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL`
  - `email text NOT NULL`
  - `papel text DEFAULT 'profissional' CHECK (papel IN ('gerente', 'profissional'))`
  - `token text UNIQUE NOT NULL`
  - `status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'expirado'))`
  - `expira_em timestamptz NOT NULL`
  - `criado_em timestamptz`, `respondido_em timestamptz`

### Funções e Triggers
- `criar_barbearia_com_dono(nome, slug, telefone, email, endereco, bairro, cidade, estado, cep)`: RPC atômica que cria a barbearia e adiciona o `auth.uid()` como `dono` em `membros_barbearia`.
- `aceitar_convite_equipe(token_convite)`: RPC que valida expiração, associa `usuario_id` ao profissional e insere em `membros_barbearia`.

---

## 3. Aplicações e Interfaces (`apps/parceiro`)

Rotas:
- `/onboarding`: Wizard em 3 passos para o dono (Identificação, Contato/Localização e Primeiro Profissional/Equipe).
- `/painel`: Dashboard geral, dias restantes de trial de 30 dias, status de ativação e atalhos rápidos.
- `/equipe`: Tabela/cards de membros e profissionais com badges de função (`Dono`, `Gerente`, `Profissional`) e status de convite.
- `/equipe/[id]`: Edição de bio, telefone e papel.
- `/convites`: Gestão de convites pendentes e geração de links de convite.
- `/convite/[token]`: Tela pública no parceiro para aceitar o convite e vincular a conta.
- `/configuracoes/perfil`: Gestão dos dados institucionais da barbearia.

---

## 4. Design System e UX (`ui-ux-pro-max`)

- Badges com cores semânticas:
  - Dono: primária cobre `#B45A2B`
  - Gerente: azul `#2563EB`
  - Profissional: card secundário com borda
  - Status Ativo: verde `#16A34A`, Pendente: amarelo `#EAB308`
- Touch targets >= 44x44px em botões de ação e tabelas responsivas.
- Estados de loading, formulários acessíveis e feedback de erro.

---

## 5. Estratégia de Testes

- Schemas Zod: dados da barbearia, validação de slug amigável, e-mails de convite e papéis válidos.
- Verificação de RLS e multi-tenant no script SQL (garantindo que membros da Barbearia A não acessam a Barbearia B).
- RPC atômica de criação de barbearia com dono inicial.
