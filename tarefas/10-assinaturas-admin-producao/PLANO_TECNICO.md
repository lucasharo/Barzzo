# Plano Técnico de Implementação — TASK-10: Assinaturas, Admin e Produção

**Autor**: Líder Técnico  
**Data**: 25/09/2026  
**Status**: Aprovado  

---

## 1. Arquitetura da Solução

### 1.1 Modelagem de Banco de Dados (`supabase/migrations/20260925000009_planos_assinaturas_admin.sql`)
1. **Tabela `public.planos`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `identificador TEXT NOT NULL UNIQUE CHECK (identificador IN ('solo', 'pro', 'growth', 'rede'))`
   - `nome TEXT NOT NULL`
   - `descricao TEXT`
   - `limite_profissionais INTEGER` (nulo para ilimitado)
   - `preco_mensal NUMERIC(10,2) NOT NULL`
   - `preco_semestral NUMERIC(10,2) NOT NULL`
   - `ativo BOOLEAN NOT NULL DEFAULT true`
   - `ordem INTEGER NOT NULL DEFAULT 0`
   - `recursos JSONB DEFAULT '[]'::jsonb`
   - `criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - *Seed*: Carga inicial idempotente dos 4 planos oficiais.
   - *RLS*: Leitura pública de planos ativos para o parceiro; modificação exclusiva de administradores.

2. **Tabela `public.assinaturas`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE`
   - `plano_id UUID NOT NULL REFERENCES public.planos(id)`
   - `ciclo TEXT NOT NULL CHECK (ciclo IN ('mensal', 'semestral'))`
   - `status TEXT NOT NULL CHECK (status IN ('trial', 'ativa', 'vencida', 'suspensa', 'cancelada'))`
   - `data_inicio TIMESTAMPTZ NOT NULL`
   - `data_fim TIMESTAMPTZ NOT NULL`
   - `data_cancelamento TIMESTAMPTZ`
   - `mercado_pago_subscription_id TEXT`
   - `mercado_pago_payment_id TEXT`
   - `valor NUMERIC(10,2) NOT NULL`
   - `criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - `atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - *RLS*: Membros da barbearia podem ler sua própria assinatura; administradores leem e operam todas.

3. **Tabela `public.beneficios_assinatura`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE`
   - `tipo TEXT NOT NULL CHECK (tipo IN ('extensao_trial', 'desconto', 'dias_bonus'))`
   - `dias_concedidos INTEGER NOT NULL`
   - `motivo TEXT NOT NULL`
   - `concedido_por UUID NOT NULL REFERENCES public.usuarios(id)`
   - `criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - *RLS*: Visível para a barbearia; criação exclusiva de administradores.

4. **Tabela `public.logs_auditoria`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL`
   - `barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE SET NULL`
   - `acao TEXT NOT NULL`
   - `entidade TEXT NOT NULL`
   - `entidade_id UUID`
   - `dados_anteriores JSONB`
   - `dados_novos JSONB`
   - `ip TEXT`
   - `criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`
   - *RLS*: Exclusivo para administradores Barzzo.

5. **RPCs PostgreSQL de Negócio e Segurança**:
   - `conceder_extensao_trial(p_barbearia_id UUID, p_dias INTEGER, p_motivo TEXT)`:
     - Validação de perfil admin.
     - Incrementa `trial_fim` em `p_dias`.
     - Registra em `beneficios_assinatura` e em `logs_auditoria`.
   - `processar_confirmacao_pagamento_assinatura(...)`:
     - Idempotência com trava única baseada em `mercado_pago_payment_id`.
     - Ativação imediata da assinatura e extensão da vigência conforme o ciclo (1 mês ou 6 meses).
   - `obter_metricas_admin_global()`:
     - Agregação consolidada para o painel administrativo.

---

## 2. Pacotes Compartilhados

### 2.1 `@barzzo/tipos`
- `Plano`, `Assinatura`, `CicloAssinatura`, `StatusAssinatura`, `BeneficioAssinatura`, `LogAuditoria`, `MetricasAdminGlobal`.

### 2.2 `@barzzo/validacoes`
- `esquemaPlano`: Validação de preços positivos e limites de equipe.
- `esquemaBeneficioAssinatura`: Validação de dias positivos e justificativa mínima.
- `esquemaCheckoutAssinatura`: Seleção de plano e ciclo.

### 2.3 `@barzzo/dominio`
- `calcularMRR(assinaturasAtivas)`: Soma precisa do faturamento mensal recorrente (mensal + semestral/6).
- `verificarAcessoPlano(status, trialFim, agora)`: Máquina de estados para liberação de funcionalidades.
- `validarCapacidadeEquipe(limiteProfissionais, totalMembros)`: Checagem contra excedentes de equipe.

---

## 3. Aplicações e Telas

### 3.1 App Parceiro (`apps/parceiro`)
- **`/assinatura`**:
  - Exibição do status atual (Trial de 30 dias com contador regressivo).
  - Tabela comparativa dos planos (Solo, Pro, Growth, Rede).
  - Toggle Mensal / Semestral com destaque de economia.
  - Botão de contratação integrada via Mercado Pago (Sandbox / Produção com fallback para chaves pendentes).

### 3.2 App Admin (`apps/admin`)
- Navegação completa e rotas dedicadas:
  - `/painel`: Métricas globais (MRR, Barbearias, Assinaturas, Agendamentos).
  - `/barbearias`: Gestão com modal de extensão de trial (+30 dias de retenção).
  - `/usuarios`: Gestão de contas de clientes e profissionais.
  - `/assinaturas`: Extrato financeiro de planos.
  - `/agendamentos`: Supervisão de reservas no marketplace.
  - `/influenciadores`: Desempenho e comissões da rede parceira.
  - `/avaliacoes`: Moderação de notas e comentários.
  - `/logs`: Trilha de auditoria inalterável.

---

## 4. Estratégia de Testes

1. Testes unitários para cálculo de MRR, validação de capacidade da equipe e verificação de vigência de planos.
2. Testes de integridade da migration, constraints e RPCs de auditoria e benefício.
3. Typecheck estático nos 3 apps (`apps/parceiro`, `apps/cliente`, `apps/admin`).
4. Auditoria de acessibilidade e design system com a skill `ui-ux-pro-max`.

---

## 5. Aprovação Técnica

Plano técnico aprovado pelo **Líder Técnico**. Transição para **EM_DESENVOLVIMENTO** autorizada.
