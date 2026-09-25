# Plano Técnico — TASK-03: Serviços, Jornadas e Disponibilidade

## 1. Visão Geral da Arquitetura

A TASK-03 estabelece a espinha dorsal de catálogo e motor de tempo do Barzzo:
1. **Catálogo de Serviços**: Serviços oferecidos pela barbearia com nome, descrição, preço em reais e duração em minutos. No MVP, o preço e a duração são padronizados por serviço (iguais para todos os profissionais).
2. **Vínculo Profissional-Serviço**: Tabela N:N `profissionais_servicos` determinando quais profissionais executam quais serviços.
3. **Horários de Funcionamento da Barbearia**: Tabela `horarios_barbearia` definindo o horário geral da barbearia por dia da semana (0 = Domingo a 6 = Sábado), incluindo abertura, fechamento e almoço/intervalo.
4. **Jornada de Trabalho do Profissional**: Tabela `jornadas_profissionais` especificando quando cada profissional atende na semana, respeitando ou sendo um subconjunto do horário de funcionamento da barbearia.
5. **Bloqueios de Agenda**: Tabela `bloqueios_agenda` para interrupções temporárias pontuais (ex: folga, médico, feriado, manutenção de cadeira), podendo ser aplicados a um profissional específico ou à barbearia inteira.
6. **Motor de Disponibilidade Central (`buscar_horarios_disponiveis`)**:
   Implementado tanto como função lógica reutilizável em `@barzzo/dominio` quanto como RPC SQL no Supabase, garantindo cálculo rápido, idempotente e seguro para o fluxo de reserva do cliente e agendamento interno do parceiro.

---

## 2. Estrutura do Banco de Dados e Migrations

Arquivo: `supabase/migrations/20260925000002_criar_servicos_e_disponibilidade.sql`

### 2.1 Tabela `public.servicos`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
- `nome text NOT NULL`
- `descricao text`
- `preco numeric(10, 2) NOT NULL CHECK (preco >= 0)`
- `duracao_minutos integer NOT NULL CHECK (duracao_minutos > 0)`
- `ativo boolean DEFAULT true NOT NULL`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `atualizado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`

Índices:
- `idx_servicos_barbearia_ativo ON public.servicos(barbearia_id, ativo)`

### 2.2 Tabela `public.profissionais_servicos`
- `profissional_id uuid REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL`
- `servico_id uuid REFERENCES public.servicos(id) ON DELETE CASCADE NOT NULL`
- `ativo boolean DEFAULT true NOT NULL`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `PRIMARY KEY (profissional_id, servico_id)`

### 2.3 Tabela `public.horarios_barbearia`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
- `dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6)`
- `hora_abertura time NOT NULL`
- `hora_fechamento time NOT NULL`
- `hora_inicio_almoco time`
- `hora_fim_almoco time`
- `ativo boolean DEFAULT true NOT NULL`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `atualizado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `CONSTRAINT uq_horarios_barbearia_dia UNIQUE (barbearia_id, dia_semana)`
- `CONSTRAINT check_horario_funcionamento CHECK (hora_abertura < hora_fechamento)`
- `CONSTRAINT check_almoco CHECK (hora_inicio_almoco IS NULL OR (hora_fim_almoco IS NOT NULL AND hora_inicio_almoco < hora_fim_almoco AND hora_inicio_almoco >= hora_abertura AND hora_fim_almoco <= hora_fechamento))`

### 2.4 Tabela `public.jornadas_profissionais`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `profissional_id uuid REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL`
- `dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6)`
- `hora_inicio time NOT NULL`
- `hora_fim time NOT NULL`
- `hora_inicio_pausa time`
- `hora_fim_pausa time`
- `ativo boolean DEFAULT true NOT NULL`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `atualizado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `CONSTRAINT uq_jornada_profissional_dia UNIQUE (profissional_id, dia_semana)`
- `CONSTRAINT check_jornada CHECK (hora_inicio < hora_fim)`
- `CONSTRAINT check_pausa CHECK (hora_inicio_pausa IS NULL OR (hora_fim_pausa IS NOT NULL AND hora_inicio_pausa < hora_fim_pausa AND hora_inicio_pausa >= hora_inicio AND hora_fim_pausa <= hora_fim))`

### 2.5 Tabela `public.bloqueios_agenda`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `barbearia_id uuid REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL`
- `profissional_id uuid REFERENCES public.profissionais(id) ON DELETE CASCADE` -- NULL significa bloqueio de toda a barbearia
- `inicio timestamptz NOT NULL`
- `fim timestamptz NOT NULL`
- `motivo text NOT NULL`
- `criado_em timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL`
- `CONSTRAINT check_datas_bloqueio CHECK (inicio < fim)`

Índices:
- `idx_bloqueios_barbearia_datas ON public.bloqueios_agenda(barbearia_id, inicio, fim)`
- `idx_bloqueios_profissional_datas ON public.bloqueios_agenda(profissional_id, inicio, fim)`

---

## 3. Segurança e Políticas de RLS (Multi-Tenant)

- **Leitura Pública**:
  - `servicos`: Permite `SELECT` público para registros `ativo = true` (para marketplace / catálogo do cliente sem login). Permite membros com papel `dono`/`gerente` verem todos os serviços (mesmo inativos).
  - `profissionais_servicos`: Permite `SELECT` público para registros `ativo = true`.
  - `horarios_barbearia`: Permite `SELECT` público para barbearias ativas (cálculo de slots no marketplace).
  - `jornadas_profissionais`: Permite `SELECT` público para profissionais ativos.
  - `bloqueios_agenda`: Permite `SELECT` para membros da barbearia (dono, gerente, profissional) e leitura pública dos horários ocupados para motor de agendamento.
- **Escrita (INSERT, UPDATE, DELETE)**:
  - `servicos`, `horarios_barbearia`, `bloqueios_agenda`: Restrito a donos e gerentes da barbearia (`public.usuario_eh_dono_ou_gerente(barbearia_id)`).
  - `profissionais_servicos`: Dono/gerente pode vincular/desvincular serviços.
  - `jornadas_profissionais`: Dono, gerente ou o próprio profissional (se vinculado via `usuario_id = auth.uid()`).

---

## 4. Motor de Disponibilidade (`@barzzo/dominio`)

Regras determinísticas:
1. Uma barbearia só atende se tiver horário cadastrado e ativo para o dia da semana da data solicitada.
2. O serviço precisa estar ativo.
3. Se um `profissional_id` for especificado: ele deve estar ativo e vinculado ao serviço.
4. Se nenhum `profissional_id` for especificado: todos os profissionais ativos vinculados ao serviço são avaliados; se ao menos um estiver livre em determinado slot, o slot é marcado como disponível.
5. Um slot para um profissional é válido se e somente se:
   - Está dentro da jornada ativa do profissional para aquele dia da semana.
   - O horário de término do serviço (`slot + duracao`) não ultrapassa o horário de fim da jornada do profissional nem o horário de fechamento da barbearia.
   - O intervalo `[slot, slot + duracao]` não intercepta a pausa da jornada do profissional.
   - O intervalo `[slot, slot + duracao]` não intercepta o almoço/intervalo geral da barbearia.
   - O intervalo `[slot, slot + duracao]` não intercepta nenhum bloqueio pontual daquele profissional nem da barbearia.
   - O intervalo `[slot, slot + duracao]` não intercepta agendamentos já confirmados/em andamento.
   - Se a data for hoje, o slot é posterior à hora corrente (`now() + antecedencia_minima`).

Granularidade padrão: slots gerados em intervalos de 30 minutos (ou alinhados com a duração mínima/fatia da barbearia).

---

## 5. Aplicações e Interfaces (`apps/parceiro`)

Rotas a implementar:
- `/servicos`: Listagem de serviços da barbearia com busca, filtro (ativo/inativo), badges de duração/preço e botão de novo serviço.
- `/servicos/[id]`: Formulário completo de cadastro/edição (nome, descrição, preço formatado em BRL, duração em minutos com botões rápidos de 15, 30, 45, 60 min, toggle ativo e seleção de profissionais vinculados).
- `/horarios`: Grade semanal de funcionamento da barbearia (segunda a domingo), com toggle liga/desliga por dia, inputs de abertura, fechamento e horário de almoço opcional.
- `/equipe/[id]/jornada`: Grade semanal individual do profissional selecionado, permitindo definir seus dias e horários de trabalho e pausa.
- `/agenda/bloqueios`: Visualização e cadastro de bloqueios temporários (profissional específico ou barbearia inteira), com data/hora de início e fim e motivo.

---

## 6. Padrões de Design System e UX (`ui-ux-pro-max`)

- **Tipografia**: Roboto com pesos 400, 500, 700.
- **Paleta**:
  - Primária: `#B45A2B` (Barzzo Copper)
  - Fundo escuro em camadas: `#0D0D0D`, `#171717`, `#262626`
  - Bordas: `#2E2E2E`
  - Acentos funcionais: Verde `#16A34A` (ativo), Vermelho `#DC2626` (bloqueio/inativo)
- **Componentes de Tempo e Semana**:
  - Seletores de dia da semana com chips compactos (`Dom`, `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`).
  - Inputs de hora sem complicação (HTML5 `type="time"` estilizado com visual escuro consistente).
  - Botões de seleção rápida de duração (15m, 30m, 45m, 60m, 90m, 120m).
  - Touch targets mínimos de 44x44px.

---

## 7. Estratégia de Testes Automatizados

1. **Testes Unitários de Domínio (`@barzzo/dominio`)**:
   - Geração de slots válidos dentro da jornada.
   - Rejeição de horários que ultrapassam o fechamento (duração cruzando fechamento).
   - Bloqueio por intervalo de almoço e pausa do profissional.
   - Bloqueio por `bloqueios_agenda` de dia inteiro e pontual.
   - Agregação de múltiplos profissionais para "qualquer profissional".
   - Serviço inativo retornando lista vazia.
   - Barbearia fechada no dia retornando lista vazia.
2. **Testes de Validação e Schemas (`@barzzo/validacoes`)**:
   - `esquemaServico`: nome obrigatório, preço positivo, duração maior que 0.
   - `esquemaHorarioSemanal`: abertura anterior a fechamento, validação de almoço.
   - `esquemaBloqueioAgenda`: início anterior ao fim, motivo obrigatório.
3. **Testes de Migração e RLS**:
   - Verificação das 5 novas tabelas, constraints de unicidade e policies RLS multi-tenant.
