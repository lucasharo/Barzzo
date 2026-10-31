# PLANO TÉCNICO — TASK-12: Influenciadores globais do Barzzo

## 1. Modelagem de Dados

### Tabelas Modificadas

1. **`public.cupons`**:
   - `barbearia_id`: alterado para aceitar `NULL` quando `origem = 'BARZZO_GLOBAL'`.
   - Constraint de integridade: `CHECK ((origem = 'BARZZO_GLOBAL') = (barbearia_id IS NULL))`.
   - Status de aprovação: coluna `status_aprovacao` (`pendente`, `aprovado`, `rejeitado`).
   - Índice único para códigos globais: `idx_cupons_global_codigo_unico` no escopo `WHERE origem = 'BARZZO_GLOBAL'`.

2. **`public.influenciadores`**:
   - `barbearia_id`: alterado para aceitar `NULL` para influenciadores globais.
   - Constraint: `CHECK (barbearia_id IS NOT NULL OR usuario_id IS NOT NULL)`.
   - Índice único: `idx_influenciadores_global_por_usuario` para `usuario_id` quando `barbearia_id IS NULL`.

3. **`public.barbearias`**:
   - Coluna `aceita_influenciadores_barzzo BOOLEAN DEFAULT FALSE NOT NULL`.

### Regras de Cupom Pré-provisionadas

No cadastro do influenciador, o cupom global é provisionado com 2 regras com escopo `GLOBAL_BARZZO`:
1. **Regra 1 (Prioridade 10)**: primeiro atendimento global (`atendimentos_minimos = 0`, `atendimentos_maximos = 0`), desconto de 15% (percentual), limite de 1 uso por cliente.
2. **Regra 2 (Prioridade 20)**: demais atendimentos (`atendimentos_minimos = 1`, `atendimentos_maximos = NULL`), desconto de 5% (percentual), sem limite por cliente.

## 2. RPCs e Segurança (PostgreSQL Functions)

1. **`cadastrar_influenciador_barzzo(p_nome, p_telefone, p_chave_pix, p_codigo)`**:
   - Exige autenticação (`auth.uid() IS NOT NULL`).
   - Insere em `influenciadores` com comissão padrão de 5% e vínculo com o usuário.
   - Insere em `cupons` com status `pendente` e cria as regras padrão de 15% e 5%.
   - Revogado de `anon` e `PUBLIC`.

2. **`alterar_cupom_influenciador_barzzo(p_codigo)`**:
   - Permite que o influenciador ajuste o código enquanto o status for `pendente` ou `rejeitado`.
   - Impede alteração após aprovação (somente Admin pode alterar).

3. **`admin_decidir_cupom_global(p_cupom_id, p_aprovar)`**:
   - Protegido por `public.eh_admin()`.
   - Altera `status_aprovacao` para `aprovado` ou `rejeitado` e atualiza `ativo`.

4. **`admin_atualizar_influenciador_global(p_influenciador_id, p_tipo_comissao, p_valor_comissao, p_desconto_primeiro, p_desconto_demais, p_ativo)`**:
   - Protegido por `public.eh_admin()`.
   - Atualiza dados comerciais do influenciador e atualiza as regras de desconto correspondentes no cupom.

5. **`obter_cupom_por_codigo(p_barbearia_id, p_codigo)` e `registrar_uso_cupom(...)`**:
   - Validação estrita: se o cupom tiver origem `BARZZO_GLOBAL`, ele deve possuir `status_aprovacao = 'aprovado'` e a barbearia informada deve ter `aceita_influenciadores_barzzo = true`. Caso contrário, recusa a aplicação com mensagem clara.

## 3. Interfaces e Fluxos

- **`apps/parceiro/src/pages/influenciador/Cadastro.tsx`**: tela de auto-cadastro para visitantes e usuários logados, com formulário validado e feedback de submissão.
- **`apps/parceiro/src/pages/influenciador/Painel.tsx`**: portal com estatísticas, métricas de comissão (pendente/paga), atalhos de cópia de cupom e link `?cupom=CODIGO`.
- **`apps/parceiro/src/pages/influenciadores/Influenciadores.tsx`**: tela operacional da barbearia com switch `aceita_influenciadores_barzzo`.
- **`apps/admin/src/app/influenciadores/page.tsx`**: visualização separada por tabela de influenciadores da rede Barzzo, badge de pendentes, botões de decisão e modal de edição completa.
- **`apps/parceiro/src/components/navegacao-parceiro.tsx`**: item de navegação `Painel do Influenciador` na gaveta do menu.

## 4. Testes

- `tests/seguranca/influenciadores-barzzo.test.ts`: 8 asserções cobrindo integridade referencial, constraints, grants/revokes, aprovação exclusiva pelo admin, recusa de cupons não aceitos pela barbearia e cálculo de 15% / 5%.
