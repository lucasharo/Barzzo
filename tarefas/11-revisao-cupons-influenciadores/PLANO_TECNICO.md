# Plano Técnico — TASK-11: Revisão de cupons e influenciadores

**Responsável:** Líder Técnico
**Status:** Aprovado para desenvolvimento

## 1. Banco e migration

Criar migration incremental `20260930135753_revisao_cupons_influenciadores.sql`, preservando todas as anteriores.

- `cupons`: adicionar `origem` e `influenciador_id`; manter `cupom_padrao_id` somente como compatibilidade histórica; backfill do vínculo conhecido.
- `cupons_regras`: regras ordenadas por prioridade, histórico mínimo/máximo, escopo, tipo/valor, mínimo, limite total/cliente, serviços elegíveis e vigência herdada do cupom.
- `cupons_utilizacoes`: histórico individual com status `reservado`, `consumido`, `liberado`, `cancelado`, snapshot da regra e valores.
- `agendamentos`: campos comerciais de snapshot e vínculos opcionais com `ON DELETE SET NULL`; trigger impede que o cliente injete snapshot na inserção.
- `comissoes_influenciadores`: campos de bruto/elegível/líquido/cupom e constraint existente de uma comissão por agendamento.
- índice único parcial para uma atribuição por agendamento; índices de histórico por cupom, cliente, status e escopo.
- RLS em regras/utilizações e grants mínimos para RPCs.

Backfill: criar uma regra padrão a partir das colunas legadas e copiar associações `influenciadores.cupom_padrao_id` para `cupons.influenciador_id` sem apagar dados.

## 2. RPCs e transação

Recriar `registrar_uso_cupom` para localizar o cupom por código, bloquear sua linha, contar usos não liberados, selecionar a regra elegível pelo histórico correto, calcular subtotal elegível a partir de `agendamentos_servicos`, congelar o snapshot e inserir utilização/indicação na mesma transação. O influencer é sempre lido do cupom.

Recriar `processar_comissao_conclusao_atendimento` para exigir `concluido`, ler somente o snapshot do agendamento, usar `ON CONFLICT (agendamento_id) DO NOTHING` e não consultar `influenciadores.ativo` nem a taxa atual. Trigger de conclusão garante processamento mesmo quando a UI não chama RPC adicional. Trigger de cancelamento/no-show libera uso e cancela comissão pendente.

## 3. Domínio e contratos

Adicionar tipos `CupomRegra`, `CupomUtilizacao`, estados/origem/escopo e snapshot. Evoluir `calcularDescontoCupom` para receber serviços com preços, calcular subtotal elegível, selecionar faixa configurável e manter compatibilidade de leitura com cupom legado. Evoluir comissão para receber valor líquido e preservar cálculo fixo.

## 4. Aplicações

- Cliente: query `cupom`, persistência apenas no rascunho da reserva atual, troca substitutiva, preview por serviços/preços, RPC final transacional e remoção de uso legado de `ref`.
- Parceiro: formulário com origem/influencer, regras de primeiro/seguintes ou faixas, escopo, limites, serviços, mínimo, vigência e ativo; explicações em pt-BR e controles acessíveis.
- Refinamento PO: usar um único switch `Apenas 1ª Reserva` na seção de faixas; deixar os campos da faixa seguinte visíveis quando desligado e omiti-los da UI e do payload quando ligado. Sem desconto seguinte informado, preservar cupom com regra única.
- Refinamento PO: separar visualmente primeiro atendimento e demais atendimentos; posicionar o switch `Apenas 1ª Reserva` dentro da segunda seção, ocultando seus campos e apresentando aviso quando ativo. Limites por cliente independentes por faixa, com limite total compartilhado.
- Parceiro: reutilizar o formulário de cadastro para editar influenciadores da própria barbearia, inclusive comissão e status ativo/inativo; confirmar atualização por ID e barbearia, preservando os snapshots de comissões anteriores.
- Refinamento PO: no Parceiro, o escopo do histórico é fixo em `BARBEARIA`, sem seletor global; RLS permite `GLOBAL_BARZZO` apenas ao Admin.
- Admin/relatórios: manter consultas compatíveis com snapshots e status existentes.

## 5. Testes e gates

Atualizar testes unitários para os 33 cenários, adicionar verificações estáticas da migration/RLS/RPC, executar Vitest, `scripts/testar.mjs`, typecheck, build e revisão de segurança. Registrar limitações de QA manual quando não houver sessão/browser/ambiente de teste disponível.
