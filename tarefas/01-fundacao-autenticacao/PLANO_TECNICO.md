# Plano Técnico — TASK-01: Fundação, Autenticação e Usuários

## 1. Visão Geral e Arquitetura

Esta task estabelece a fundação de todo o ecossistema Barzzo em formato de **monorepo com três aplicações independentes** e pacotes de suporte compartilhados, além de fornecer o módulo completo de autenticação e gerenciamento de perfil com Supabase.

### Estrutura do Monorepo
```text
barzzo/
├── apps/
│   ├── cliente/             # PWA Marketplace + experiência do cliente
│   ├── parceiro/            # App para dono, gerente e profissional
│   └── admin/               # Web Admin Barzzo
├── packages/
│   ├── ui/                  # Componentes base shadcn/ui alinhados ao Design System Barzzo
│   ├── tipos/               # Tipos TypeScript do domínio e banco de dados
│   ├── supabase/            # Clientes browser, server e utilitários de sessão Supabase
│   ├── validacoes/          # Schemas Zod para formulários e validações de regras
│   ├── imagens/             # Validação, redimensionamento (máx 800x800) e compressão
│   ├── utilitarios/         # Formatadores, helpers e utilitários gerais
│   └── dominio/             # Regras de negócio compartilhadas
└── supabase/
    ├── migrations/          # Scripts SQL reproduzíveis com RLS
    └── functions/           # Edge Functions
```

---

## 2. Banco de Dados e Migrations

Arquivo: `supabase/migrations/20260925000000_criar_usuarios_e_auth.sql`

### Tabela `public.usuarios`
- `id`: `uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `nome`: `text NOT NULL`
- `email`: `text NOT NULL UNIQUE`
- `telefone`: `text NULL`
- `foto_url`: `text NULL`
- `criado_em`: `timestamptz DEFAULT now() NOT NULL`
- `atualizado_em`: `timestamptz DEFAULT now() NOT NULL`

### Triggers & Funções
1. `funcao_atualizar_timestamp()`: atualiza `atualizado_em` no `BEFORE UPDATE`.
2. `funcao_ao_criar_usuario_auth()`: disparada no `AFTER INSERT` de `auth.users`, criando automaticamente o registro correspondente em `public.usuarios` com `raw_user_meta_data->>'nome'`, `email` e telefone caso informados.

### Segurança e RLS
- RLS ativado em `public.usuarios`:
  - `SELECT`: `auth.uid() = id` (no MVP Task 01; o próprio usuário lê seus dados).
  - `UPDATE`: `auth.uid() = id` (o usuário só edita seu próprio perfil; sem permissão de alterar IDs ou campos alheios).
  - `INSERT`: `auth.uid() = id` (ou disparado pelo trigger seguro do Postgres).
- Storage Bucket `avatares`:
  - Bucket configurado para arquivos de imagem com tamanho máximo de 5MB.
  - Leitura pública dos avatares para visualização do perfil.
  - Políticas de Upload/Update/Delete restritas ao próprio usuário proprietário: `(storage.foldername(name))[1] = auth.uid()::text`.

---

## 3. Aplicações e Rotas (Task 01)

### `apps/cliente`
- Rotas públicas de autenticação e conta:
  - `/entrar`: Login por e-mail e senha com feedback de erro e link para recuperação.
  - `/cadastro`: Criação de conta com nome completo, e-mail, senha e telefone.
  - `/recuperar-senha`: Envio de link de redefinição de senha.
  - `/perfil`: Edição de perfil (nome, telefone, upload e remoção de foto) com proteção de sessão.
- PWA:
  - `manifest.json` com nome Barzzo, cores da marca e ícones.
  - Suporte responsivo mobile-first.

### `apps/parceiro` e `apps/admin`
- Estrutura base de inicialização independente, compartilhando os mesmos tokens e pacotes (`packages/*`).

---

## 4. Design System e UX (Alinhado à skill ui-ux-pro-max)

- Tipografia: **Roboto** (pesos 400, 500, 600, 700).
- Cores:
  - Tema Claro: `--fundo: #FFFFFF`, `--card-primario: #F6F6F7`, `--card-secundario: #EEEEF0`, `--card-terciario: #E5E5E8`, `--texto: #000000`.
  - Tema Escuro: `--fundo: #0A0A0B`, `--card-primario: #141416`, `--card-secundario: #1C1C1F`, `--card-terciario: #252529`, `--texto: #FFFFFF`.
  - Primária: `--primaria: #B45A2B`, hover `--primaria-hover: #C46632`, active `--primaria-pressionada: #984820`.
  - Alertas funcionais: `--info: #2563EB`, `--sucesso: #16A34A`, `--alerta: #EAB308`, `--erro: #DC2626`.
- Acessibilidade & Interatividade:
  - Touch targets mínimos de 44x44px.
  - Labels explícitos e sem dependência exclusiva de placeholders.
  - Estados completos: Loading (spinners em botões, skeletons), Vazio, Erro e Sucesso.

---

## 5. Estratégia de Testes

1. **Unitários**:
   - Validações Zod (formato de e-mail, força de senha, telefone brasileiro, nome).
   - Utilitário de redimensionamento e processamento de imagem (`packages/imagens`).
2. **Componentes / Integração**:
   - Renderização dos formulários de login, cadastro, recuperação e perfil.
   - Feedback de loading e estados de erro.
   - Alternância entre tema claro e escuro.
3. **Segurança & RLS**:
   - Garantia de isolamento: usuário não pode atualizar registros com outro ID.
   - Verificação de políticas no SQL da migration.

---

## 6. Critérios de Aceite e Verificação Técnica
- [x] Monorepo configurado com `apps/cliente`, `apps/parceiro`, `apps/admin` e `packages/*`.
- [x] Migrations SQL para `usuarios`, triggers e políticas RLS criadas e idempotentes.
- [x] Fluxos de cadastro, login, logout, recuperação e edição de perfil implementados.
- [x] Redimensionamento e compressão de foto de perfil (máx 800x800).
- [x] Design System oficial integralmente aplicado (Roboto, tokens de cor, temas claro/escuro).
- [x] Testes automatizados executando com sucesso.
- [x] Nenhum segredo ou chave privada versionado.
