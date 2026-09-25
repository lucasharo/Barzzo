# Plano Técnico de Implementação — TASK-09: Notificações, Dashboard e Relatórios

**Autor**: Líder Técnico  
**Data**: 25/09/2026  
**Status**: Aprovado  

---

## 1. Arquitetura da Solução

### 1.1 Modelagem de Dados e Segurança (`supabase/migrations/20260925000008_notificacoes_dashboard_relatorios.sql`)
1. **Tabela `public.dispositivos`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE`
   - `fcm_token TEXT NOT NULL`
   - `plataforma TEXT NOT NULL CHECK (plataforma IN ('web', 'android', 'ios'))`
   - `ativo BOOLEAN NOT NULL DEFAULT true`
   - `modelo TEXT`
   - `ultimo_acesso_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - `criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - `CONSTRAINT dispositivos_usuario_token_key UNIQUE (usuario_id, fcm_token)`
   - *RLS*: Usuário autenticado lê, atualiza e remove apenas seus próprios dispositivos (`auth.uid() = usuario_id`).

2. **Tabela `public.preferencias_notificacao`**:
   - `usuario_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE`
   - `notificacoes_transacionais BOOLEAN NOT NULL DEFAULT true`
   - `notificacoes_promocionais BOOLEAN NOT NULL DEFAULT true`
   - `notificacoes_lembretes BOOLEAN NOT NULL DEFAULT true`
   - `atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - *RLS*: Gerenciado exclusivamente pelo dono da conta (`auth.uid() = usuario_id`).

3. **Tabela `public.notificacoes`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE`
   - `titulo TEXT NOT NULL`
   - `corpo TEXT NOT NULL`
   - `tipo TEXT NOT NULL CHECK (tipo IN ('confirmacao', 'cancelamento', 'lembrete', 'reagendamento', 'promocao', 'sistema'))`
   - `lida BOOLEAN NOT NULL DEFAULT false`
   - `lida_em TIMESTAMPTZ`
   - `link TEXT`
   - `metadata JSONB DEFAULT '{}'::jsonb`
   - `criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - *RLS*: Leitura e atualização de status (marcar como lida) restritas ao próprio destinatário (`auth.uid() = usuario_id`).

4. **Coluna de Idempotência em `public.agendamentos`**:
   - `lembrete_enviado BOOLEAN NOT NULL DEFAULT false` (caso não exista, adicionar com default `false`).

5. **RPCs e Funções Analíticas PostgreSQL**:
   - `registrar_dispositivo(p_fcm_token, p_plataforma, p_modelo)`: Salva ou reativa o token com update em `ultimo_acesso_em`.
   - `obter_metricas_dashboard_hoje(p_barbearia_id, p_profissional_id DEFAULT NULL)`:
     - Agrega os agendamentos da data corrente (fuso horário local):
       - `total_hoje`, `proximos`, `em_atendimento`, `concluidos`, `cancelados_no_show`.
       - `faturamento_realizado` (soma de `preco_total` dos concluídos).
       - `faturamento_estimado` (soma dos confirmados + em atendimento).
       - `novos_clientes_hoje` (clientes cujo primeiro agendamento histórico na barbearia é hoje).
   - `obter_relatorio_geral(p_barbearia_id, p_data_inicio, p_data_fim, p_profissional_id DEFAULT NULL)`:
     - Métricas consolidadas do intervalo: total atendimentos, faturamento, ticket médio, taxa de cancelamento/no-show, tempo previsto médio vs. tempo real médio.
   - `obter_relatorio_profissionais(p_barbearia_id, p_data_inicio, p_data_fim)`:
     - Performance de cada profissional: cortes realizados, faturamento, ticket médio individual, minutos previstos vs. minutos reais.
   - `obter_relatorio_marketing(p_barbearia_id, p_data_inicio, p_data_fim)`:
     - Cupons utilizados e valor total descontado.
     - Atendimentos gerados por influenciadores e montante de comissões pendentes e pagas.

---

## 2. Pacotes Compartilhados

### 2.1 `@barzzo/tipos` (`src/notificacoes.ts` e `src/relatorios.ts`)
- Tipos de notificações: `TipoNotificacao`, `PlataformaDispositivo`, `Dispositivo`, `Notificacao`, `PreferenciasNotificacao`.
- Tipos de dashboard e relatórios: `PeriodoFiltroRelatorio`, `MetricasDashboardHoje`, `RelatorioGeral`, `DesempenhoProfissionalItem`, `DesempenhoMarketingItem`.

### 2.2 `@barzzo/validacoes` (`src/notificacoes.ts` e `src/relatorios.ts`)
- `esquemaDispositivo`: Validação de token não vazio e plataforma permitida.
- `esquemaPreferenciasNotificacao`: Booleans de permissão.
- `esquemaFiltroRelatorio`: Intervalo de datas coerente (`data_inicio <= data_fim`).

### 2.3 `@barzzo/dominio` (`src/notificacoes.ts` e `src/relatorios.ts`)
- `calcularTicketMedio(faturamento, total)`: Divisão segura com retorno 0 se `total === 0`.
- `calcularDiferencaPrevistoReal(duracaoPrevistaMin, inicioReal, fimReal)`: Cálculo em minutos e categorização (pontual, adiantado, atrasado).
- `calcularTaxaOcupacao(minutosAtendidos, minutosJornada)`: Percentual de 0 a 100%.
- `podeEnviarNotificacao(tipo, preferencias)`: Regra que valida se o usuário autorizou o tipo promocional.

---

## 3. Aplicações e Interfaces

### 3.1 App Parceiro (`apps/parceiro`)
- **`/painel`**:
  - Cards de KPI rápidos do dia: Próximos Atendimentos, Em Andamento, Concluídos, Cancelamentos/Faltas, Faturamento Realizado e Estimado.
  - Tabela/lista interativa de atendimentos de hoje com botão para início/conclusão ágil.
  - Filtro automático caso o usuário logado seja um profissional sem privilégio de dono/gerente (visualiza apenas seus próprios agendamentos e faturamento).
- **`/relatorios`**:
  - Abas: "Geral", "Profissionais", "Marketing".
  - Seletor de período rápido: Hoje, 7 Dias, 30 Dias, Mês Atual, Personalizado.
  - Tabela de desempenho individual com comparativo Previsto x Real.
- **`/notificacoes`**:
  - Lista de alertas com badges semânticos, filtros (todas / não lidas) e ação de marcar todas como lidas.
- **`layout.tsx`**:
  - Menus "Painel", "Relatórios" e ícone de notificações no topo.

### 3.2 App Cliente (`apps/cliente`)
- **`/notificacoes`**:
  - Central do cliente com histórico de confirmações, lembretes de agendamento e avisos promocionais recebidos.
  - Seletor simples de preferência para silenciar promoções.
- **Menu Superior**:
  - Adicionado ícone de Notificações ao lado do perfil.

---

## 4. Estratégia de Testes

1. **Testes Unitários de Domínio**:
   - `calcularTicketMedio`: Valores positivos, zero atendimentos, arredondamentos.
   - `calcularDiferencaPrevistoReal`: Atendimento no prazo, com atraso, ou com duração reduzida.
   - `calcularTaxaOcupacao`: Cálculo proporcional à carga horária diária.
   - `podeEnviarNotificacao`: Respeito a `notificacoes_promocionais = false`.
2. **Testes de Validação Zod**:
   - Tokens de dispositivo, plataformas aceitas, filtros de data.
3. **Testes de Segurança e RLS na Migration**:
   - Políticas de SELECT e UPDATE em `dispositivos`, `notificacoes` e `preferencias_notificacao`.
   - RPCs `obter_metricas_dashboard_hoje` e `obter_relatorio_geral`.

---

## 5. Aprovação Técnica

Plano aprovado pelo **Líder Técnico**. Transição para o estado **EM_DESENVOLVIMENTO** autorizada.
