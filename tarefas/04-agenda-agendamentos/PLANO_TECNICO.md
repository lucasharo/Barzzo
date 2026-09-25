# Plano Técnico — TASK-04: Agenda e Agendamentos

## 1. Visão Geral da Arquitetura

A TASK-04 implementa o núcleo operacional do Barzzo: a agenda da barbearia e a gestão de agendamentos com garantia absoluta de **integridade concorrente** (impossibilitando dupla reserva de um mesmo profissional no mesmo intervalo de tempo, mesmo sob requisições paralelas simultâneas).

### Regras Principais
1. **Snapshots de Serviços**: Ao criar um agendamento, os dados do serviço (nome, preço cobrado e duração estimada) são congelados em `agendamentos_servicos`. Alterações futuras no catálogo de serviços não distorcem agendamentos históricos.
2. **Ciclo de Vida e Transições de Status**:
   - `pendente`: criado via canal que requer aprovação ou confirmação.
   - `confirmado`: agendamento ativo e garantido na agenda.
   - `em_atendimento`: atendimento em andamento; registra `inicio_real = now()`.
   - `concluido`: serviço finalizado; registra `fim_real = now()`.
   - `cancelado`: cancelado pelo cliente ou pela barbearia (libera o horário).
   - `nao_compareceu` (no-show): cliente não compareceu ao horário marcado (libera o horário).
3. **Prevenção Concorrente de Sobreposição no Banco (Zero Double-Booking)**:
   - Uso de restrição de exclusão com GiST no PostgreSQL (`btree_gist`):
     `EXCLUDE USING gist (profissional_id WITH =, tstzrange(inicio_previsto, fim_previsto, '[)') WITH &&) WHERE (status NOT IN ('cancelado', 'nao_compareceu'))`
   - O banco bloqueia qualquer tentativa de sobreposição de horários para o mesmo profissional em agendamentos ativos.
4. **Agendamento com "Qualquer Profissional"**:
   - Algoritmo determinístico: busca os profissionais ativos que executam o serviço, que possuem jornada no dia e horário, que não possuem bloqueio nem agendamento conflitante, e escolhe aquele com a **menor carga do dia** (menor número de atendimentos agendados para a data).
   - Critério de desempate estável: ordenação alfabética por `nome ASC` e depois por `id ASC`.
5. **Agendamentos Manuais pela Equipe**:
   - Suporte a agendamentos sem conta de usuário obrigatória (`cliente_id = NULL`), armazenando `cliente_nome` e `cliente_telefone`.

---

## 2. Estrutura do Banco de Dados e Migrations

Arquivo: `supabase/migrations/20260925000003_criar_agendamentos_e_agenda.sql`

### 2.1 Extensões
- `CREATE EXTENSION IF NOT EXISTS btree_gist;`

### 2.2 Tabela `public.agendamentos`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
- `cliente_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL`
- `cliente_nome text NOT NULL`
- `cliente_telefone text`
- `cliente_email text`
- `profissional_id uuid REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL`
- `inicio_previsto timestamptz NOT NULL`
- `fim_previsto timestamptz NOT NULL`
- `inicio_real timestamptz`
- `fim_real timestamptz`
- `status text NOT NULL DEFAULT 'confirmado' CHECK (status IN ('pendente', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu'))`
- `observacoes text`
- `origem text NOT NULL DEFAULT 'parceiro' CHECK (origem IN ('parceiro', 'cliente', 'marketplace'))`
- `preco_total numeric(10, 2) NOT NULL CHECK (preco_total >= 0)`
- `duracao_total_minutos integer NOT NULL CHECK (duracao_total_minutos > 0)`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `atualizado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `CONSTRAINT check_agendamento_datas CHECK (inicio_previsto < fim_previsto)`
- `CONSTRAINT uq_agendamento_sem_sobreposicao EXCLUDE USING gist (profissional_id WITH =, tstzrange(inicio_previsto, fim_previsto, '[)') WITH &&) WHERE (status NOT IN ('cancelado', 'nao_compareceu'))`

Índices:
- `idx_agendamentos_barbearia_inicio ON public.agendamentos(barbearia_id, inicio_previsto)`
- `idx_agendamentos_prof_inicio ON public.agendamentos(profissional_id, inicio_previsto)`
- `idx_agendamentos_cliente ON public.agendamentos(cliente_id)`
- `idx_agendamentos_status ON public.agendamentos(status)`

### 2.3 Tabela `public.agendamentos_servicos`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE CASCADE NOT NULL`
- `servico_id uuid REFERENCES public.servicos(id) ON DELETE SET NULL`
- `nome_servico text NOT NULL`
- `preco numeric(10, 2) NOT NULL CHECK (preco >= 0)`
- `duracao_minutos integer NOT NULL CHECK (duracao_minutos > 0)`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`

---

## 3. Segurança e Políticas de RLS (Multi-Tenant)

- **Leitura (`SELECT`)**:
  - Membros da barbearia (dono, gerente, profissional) podem visualizar os agendamentos da sua barbearia.
  - O próprio cliente (`cliente_id = auth.uid()`) pode visualizar os seus agendamentos.
- **Escrita (`INSERT`, `UPDATE`, `DELETE`)**:
  - Donos e gerentes da barbearia (`public.usuario_eh_dono_ou_gerente(barbearia_id)`).
  - Profissionais podem atualizar o status dos agendamentos em que estão designados (`profissional_id` vinculado ao seu usuário).
  - Clientes podem inserir novos agendamentos e cancelar agendamentos futuros próprios.

---

## 4. Máquina de Estados e Domínio (`@barzzo/dominio`)

### Tabela de Transições Válidas
```
pendente        -> confirmado | cancelado
confirmado      -> em_atendimento | cancelado | nao_compareceu | confirmado (reagendamento)
em_atendimento  -> concluido | cancelado
concluido       -> (terminal)
cancelado       -> (terminal)
nao_compareceu  -> (terminal)
```

### Funções Centrais
- `validarTransicaoStatus(statusAtual, novoStatus): boolean`
- `selecionarProfissionalMenorCarga(candidatosDisponiveis, agendamentosDoDia): Profissional`
- `calcularDiferencaPrevistoReal(inicioPrevisto, fimPrevisto, inicioReal, fimReal)`

---

## 5. Aplicações e Interfaces (`apps/parceiro`)

Rotas:
- **`/agenda`**: Calendário operacional completo com visão diária e semanal, alternador de profissional ou equipe completa, cards de agendamento coloridos por status e botões de ação rápida.
- **`/agendamentos/novo`**: Formulário de agendamento manual pela barbearia com busca/cadastro de cliente avulso, escolha de serviço, data/slots e seleção do profissional ou opção "Qualquer Profissional".
- **`/agendamentos/[id]`**: Painel detalhado do agendamento com comparativo previsto x real, reagendamento com checagem de conflito e botões de transição rápida de status.

---

## 6. Padrões de Design System e UX (`ui-ux-pro-max`)

- Badges e cores semânticas:
  - `confirmado`: Azul `#2563EB` ou Cobre `#B45A2B`
  - `em_atendimento`: Laranja / Âmbar `#D97706` com badge de destaque
  - `concluido`: Verde `#16A34A`
  - `cancelado`: Neutro / Cinza
  - `nao_compareceu`: Vermelho `#DC2626`
- Touch targets >= 44x44px.
- Linha do tempo visual no detalhe do agendamento com marcadores de previsto vs realizado.

---

## 7. Estratégia de Testes Automatizados

1. **Testes de Concorrência e Sobreposição**:
   - Rejeição de agendamento com horários colidentes para o mesmo profissional.
   - Permissão de agendamentos no mesmo horário para profissionais distintos.
   - Liberação de slot quando o agendamento conflitante é cancelado.
2. **Testes de Transição de Status**:
   - Transições válidas e rejeição de transições inválidas (ex: tentar reabrir um atendimento concluído).
   - Gravação de `inicio_real` ao iniciar e `fim_real` ao concluir.
3. **Testes do Algoritmo "Qualquer Profissional"**:
   - Menor carga do dia e desempate estável.
4. **Testes de Validação e RLS**:
   - Schemas Zod de criação e reagendamento.
   - Verificação das migrations SQL da Task 04.
