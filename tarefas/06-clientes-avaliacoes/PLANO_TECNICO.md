# Plano Técnico — TASK-06: Clientes, Favoritos e Avaliações

**Arquiteto / Líder Técnico**: Agente Líder Técnico  
**Data**: 25/09/2026  
**Status**: Aprovado para Implementação  

---

## 1. Visão Geral da Arquitetura

A Task 06 expande a plataforma Barzzo para incluir os módulos de **Retenção, CRM Operacional e Reputação Social**:
1. **No App Parceiro (`apps/parceiro`)**:
   - Gestão de Clientes (CRM da barbearia): histórico de agendamentos, volume de gastos, cancelamentos, faltas (*no-show*), profissional favorito e observações internas estritamente confidenciais.
   - Gestão de Reputação: painel de avaliações recebidas com nota média, distribuição por estrelas e capacidade de resposta oficial da barbearia.
2. **No App Cliente (`apps/cliente`)**:
   - Lista de Barbearias Favoritas (`/favoritos`) com acesso rápido para novos agendamentos e remoção.
   - Fluxo de Avaliação Pós-Atendimento (`/avaliacoes/[agendamento_id]`) com seleção de 1 a 5 estrelas e depoimento.
   - Exibição de notas e comentários públicos no perfil da barbearia (`/barbearias/[slug]`).

---

## 2. Modelagem de Dados e Banco de Dados (Supabase / Postgres)

### 2.1 Tabela `clientes_barbearia`
Representa os clientes cadastrados ou que já agendaram na respectiva barbearia (isolamento multi-tenant).
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `usuario_id` UUID REFERENCES `usuarios(id)` ON DELETE SET NULL
- `nome` TEXT NOT NULL
- `telefone` TEXT
- `email` TEXT
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `CONSTRAINT uq_cliente_barbearia_usuario UNIQUE (barbearia_id, usuario_id)`

### 2.2 Tabela `observacoes_clientes` (Notas Internas Confidenciais)
Notas operacionais da equipe da barbearia sobre o cliente (ex: "alergia a lâmina", "gosta de café com adoçante", "corta com navalha").
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `cliente_barbearia_id` UUID NOT NULL REFERENCES `clientes_barbearia(id)` ON DELETE CASCADE
- `autor_id` UUID NOT NULL REFERENCES `usuarios(id)` ON DELETE RESTRICT
- `autor_nome` TEXT NOT NULL
- `texto` TEXT NOT NULL CHECK (char_length(trim(texto)) > 0)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

**RLS**:
- **LEITURA / ESCRITA**: Estritamente restrita aos membros ativos da barbearia (`membros_equipe`). Clientes NÃO possuem política de leitura nesta tabela em hipótese alguma.

### 2.3 Tabela `favoritos`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `cliente_id` UUID NOT NULL REFERENCES `usuarios(id)` ON DELETE CASCADE
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `CONSTRAINT uq_favorito_cliente_barbearia UNIQUE (cliente_id, barbearia_id)`

**RLS**:
- `cliente_id = auth.uid()` para SELECT, INSERT e DELETE.

### 2.4 Tabela `avaliacoes`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `agendamento_id` UUID NOT NULL UNIQUE REFERENCES `agendamentos(id)` ON DELETE CASCADE
- `cliente_id` UUID NOT NULL REFERENCES `usuarios(id)` ON DELETE CASCADE
- `cliente_nome` TEXT NOT NULL
- `profissional_id` UUID REFERENCES `profissionais(id)` ON DELETE SET NULL
- `nota` INT NOT NULL CHECK (nota >= 1 AND nota <= 5)
- `comentario` TEXT CHECK (char_length(comentario) <= 1000)
- `resposta_barbearia` TEXT CHECK (char_length(resposta_barbearia) <= 1000)
- `respondido_em` TIMESTAMPTZ
- `respondido_por` UUID REFERENCES `usuarios(id)` ON DELETE SET NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

**Regras de Integridade e RLS**:
- **Elegibilidade**: Apenas agendamentos com `status = 'concluido'` podem receber avaliação.
- **Unicidade**: Constraint `UNIQUE(agendamento_id)` garante rigorosamente no máximo 1 avaliação por atendimento.
- **Público**: SELECT permitido a `anon` e `authenticated` para que futuros clientes vejam a reputação.
- **Resposta**: UPDATE de `resposta_barbearia` permitido apenas a donos/gerentes da barbearia.

---

## 3. Pacotes Compartilhados

1. **`@barzzo/tipos`**:
   - `ClienteBarbearia`, `ObservacaoCliente`, `FavoritoBarbearia`, `Avaliacao`, `MetricasClienteCRM`.
2. **`@barzzo/validacoes`**:
   - `esquemaCriarObservacaoCliente`, `esquemaCriarAvaliacao`, `esquemaResponderAvaliacao`, `esquemaCriarClienteManual`.
3. **`@barzzo/dominio`**:
   - `calcularMediaAvaliacoes`, `agruparDistribuicaoEstrelas`, `validarElegibilidadeAvaliacao`.

---

## 4. Telas a Desenvolver

- **`apps/cliente`**:
  - `src/app/favoritos/page.tsx`
  - `src/app/avaliacoes/[agendamento_id]/page.tsx`
  - Atualização do perfil público (`src/app/barbearias/[slug]/page.tsx`) com lista de avaliações e botão de favoritar/desfavoritar.
- **`apps/parceiro`**:
  - `src/app/clientes/page.tsx`
  - `src/app/clientes/[id]/page.tsx`
  - `src/app/avaliacoes/page.tsx`
  - Adição dos links "Clientes" e "Avaliações" na barra de navegação.

---

## 5. Plano de Testes Automatizados

- Isolamento RLS das observações internas do cliente (cliente não lê).
- Bloqueio de avaliação em agendamento não concluído.
- Bloqueio de avaliação duplicada (mesmo agendamento).
- Cálculo correto de média aritmética e contagem de estrelas.
- Inclusão e remoção de favoritos com constraint de unicidade.
- Registro de resposta de avaliação pela barbearia.
