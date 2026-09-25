# Plano Técnico — TASK-08: Campanhas, Cupons e Influenciadores

**Líder Técnico**: Agente Líder Técnico  
**Data**: 25/09/2026  
**Status**: Aprovado para Implementação  

---

## 1. Visão Geral da Arquitetura

A Task 08 integra mecanismos de atração, conversão e parcerias de aquisição (influenciadores locais), desenhada com:
- **Alta Disponibilidade e Segurança RLS**: Assegurando que apenas donos/gerentes acessem dados de campanhas da sua barbearia, e influenciadores visualizem exclusivamente suas próprias comissões e métricas.
- **Auditoria e Atribuição com Persistência no Cliente**: Referência de código capturada na landing page (`?ref=XYZ` ou `?cupom=XYZ`) armazenada sob a chave `@barzzo:atribuicao_influenciador` no `localStorage`, resistindo a rotas públicas e autenticação.
- **Idempotência de Comissões**: Garantia no nível do banco via constraint `UNIQUE(agendamento_id)` para que nenhum corte gere comissão duplicada, e exclusão de comissões em atendimentos cancelados ou faltas (no-show).

---

## 2. Modelagem de Dados e Banco de Dados (Supabase / Postgres)

### 2.1 Tabela `campanhas`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `nome` TEXT NOT NULL
- `descricao` TEXT
- `data_inicio` TIMESTAMPTZ NOT NULL
- `data_fim` TIMESTAMPTZ NOT NULL
- `ativa` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 2.2 Tabela `cupons`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `campanha_id` UUID REFERENCES `campanhas(id)` ON DELETE SET NULL
- `codigo` TEXT NOT NULL (em maiúsculas)
- `descricao` TEXT
- `tipo_desconto` TEXT NOT NULL CHECK (tipo_desconto IN ('percentual', 'valor_fixo'))
- `valor_desconto` NUMERIC(10,2) NOT NULL CHECK (valor_desconto > 0)
- `valor_minimo_reserva` NUMERIC(10,2) DEFAULT 0
- `limite_usos_total` INT
- `usos_atuais` INT NOT NULL DEFAULT 0
- `limite_usos_por_cliente` INT NOT NULL DEFAULT 1
- `apenas_primeira_reserva` BOOLEAN NOT NULL DEFAULT false
- `servicos_elegiveis` UUID[] DEFAULT '{}'::uuid[]
- `data_inicio` TIMESTAMPTZ NOT NULL
- `data_fim` TIMESTAMPTZ NOT NULL
- `ativo` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `CONSTRAINT cupons_codigo_barbearia_key UNIQUE (barbearia_id, codigo)`

### 2.3 Tabela `influenciadores`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `usuario_id` UUID REFERENCES `usuarios(id)` ON DELETE SET NULL
- `nome` TEXT NOT NULL
- `codigo_ref` TEXT NOT NULL (em maiúsculas)
- `email` TEXT
- `telefone` TEXT
- `chave_pix` TEXT
- `tipo_comissao` TEXT NOT NULL CHECK (tipo_comissao IN ('percentual', 'valor_fixo'))
- `valor_comissao` NUMERIC(10,2) NOT NULL CHECK (valor_comissao >= 0)
- `cupom_padrao_id` UUID REFERENCES `cupons(id)` ON DELETE SET NULL
- `ativo` BOOLEAN NOT NULL DEFAULT true
- `cliques_rastreados` INT NOT NULL DEFAULT 0
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `CONSTRAINT influenciadores_codigo_barbearia_key UNIQUE (barbearia_id, codigo_ref)`

### 2.4 Tabela `indicacoes`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `influenciador_id` UUID NOT NULL REFERENCES `influenciadores(id)` ON DELETE CASCADE
- `cupom_id` UUID REFERENCES `cupons(id)` ON DELETE SET NULL
- `agendamento_id` UUID REFERENCES `agendamentos(id)` ON DELETE SET NULL
- `cliente_id` UUID REFERENCES `usuarios(id)` ON DELETE SET NULL
- `codigo_ref_usado` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado'))
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 2.5 Tabela `comissoes_influenciadores`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `influenciador_id` UUID NOT NULL REFERENCES `influenciadores(id)` ON DELETE CASCADE
- `indicacao_id` UUID REFERENCES `indicacoes(id)` ON DELETE SET NULL
- `agendamento_id` UUID NOT NULL REFERENCES `agendamentos(id)` ON DELETE CASCADE
- `valor_servicos` NUMERIC(10,2) NOT NULL
- `tipo_comissao` TEXT NOT NULL CHECK (tipo_comissao IN ('percentual', 'valor_fixo'))
- `taxa_comissao` NUMERIC(10,2) NOT NULL
- `valor_comissao` NUMERIC(10,2) NOT NULL CHECK (valor_comissao >= 0)
- `status` TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'cancelada'))
- `paga_em` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `CONSTRAINT comissoes_agendamento_unique UNIQUE (agendamento_id)`

---

## 3. Lógica de Domínio e Validações

1. **`calcularDescontoCupom(cupom, valorTotal, servicosIds, historicoCliente)`**:
   - Valida datas (início e fim).
   - Valida valor mínimo de reserva.
   - Valida limite de usos totais e por cliente.
   - Valida se `apenas_primeira_reserva` exige que cliente nunca tenha tido agendamento concluído.
   - Aplica percentual (arredondado em 2 casas) ou dedução de valor fixo (respeitando limite de não gerar total negativo).
2. **`calcularValorComissao(valorServicos, tipoComissao, valorTaxa)`**:
   - Se `percentual`: `(valorServicos * valorTaxa) / 100`.
   - Se `valor_fixo`: `valorTaxa`.

---

## 4. Telas a Desenvolver

- **`apps/parceiro`**:
  - `/campanhas`: Listagem com status de campanhas, cupons, contagem de usos e descontos.
  - `/campanhas/[id]`: Formulário completo de campanha/cupom.
  - `/influenciadores`: Gestão de parceiros, comissões pendentes e confirmação de pagamento de comissão.
  - `/influenciador/painel`: Visão do influenciador logado com link de indicação, cliques, cortes gerados e comissões.
  - `/influenciador/comissoes`: Histórico e extrato de comissões do influenciador.
- **`apps/cliente`**:
  - `/reservar/[slug]/confirmar`: Input de cupom com validação em tempo real e dedução visual no resumo.
  - Atribuição automática de influenciador via query parameter `?ref=XYZ`.

---

## 5. Plano de Testes
- Validação de descontos percentuais e fixos.
- Regra de primeira reserva.
- Rejeição de cupons expirados ou com limite estourado.
- Idempotência da comissão sobre agendamento concluído.
- Garantia de que agendamento cancelado não gera comissão.
- Migração SQL com RLS, índices e constraints.
