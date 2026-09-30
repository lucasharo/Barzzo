# Requisitos do PO — TASK-11: Revisão de cupons e influenciadores

**Autor:** Product Owner
**Data:** 30/09/2026
**Status:** Aprovado

## 1. Fonte de verdade

O cupom aplicado no agendamento é a fonte de verdade da atribuição comercial. Um cupom pode ter origem `BARBEARIA`, `INFLUENCIADOR` ou `BARZZO_GLOBAL`; se possuir `influenciador_id`, esse influencer é atribuído à reserva. Cupom sem influencer não gera atribuição nem comissão.

Cada reserva possui no máximo um cupom. Aplicar outro substitui o anterior, inclusive quando o novo cupom não tem influencer. `ref` não decide comissão, não sobrepõe cupom e não deve ser usado em nova arquitetura. Links novos usam `/barbearias/{slug}?cupom=CODIGO`.

O cliente reaplica o cupom em cada novo agendamento. O código pode sobreviver ao fluxo atual e à autenticação, mas não pode ser herdado por uma reserva futura.

## 2. Regras de cupom

Um influencer de aquisição precisa ter pelo menos um cupom ativo e pode possuir vários. O mesmo cupom pode ter múltiplas regras/faixas configuráveis por prioridade, escopo do histórico (`BARBEARIA` ou `GLOBAL_BARZZO`), quantidade mínima/máxima de atendimentos concluídos, tipo/valor do desconto, serviços elegíveis, valor mínimo e limites. Deve ser possível representar primeiro atendimento 15%, seguintes 5%, uso único, limite total e ilimitado sem hardcode exclusivo.

O valor mínimo usa o valor bruto. O desconto usa somente o subtotal dos serviços elegíveis e desconto fixo não supera esse subtotal.

## 3. Snapshot e comissão

Na confirmação congelar cupom, código, origem, influencer, bruto, subtotal elegível, desconto, líquido, regra e configuração da comissão. Alterações posteriores no cupom, influencer, status ativo ou taxa não mudam reserva antiga.

Comissão nasce apenas para atendimento `concluido`, uma vez por agendamento. `cancelado` e `nao_compareceu` não geram comissão. Percentual usa líquido após desconto; fixa mantém o valor congelado. O Barzzo calcula, audita, exibe e permite baixa manual (`pendente`, `paga`, `cancelada`), sem split ou pagamento automático.

## 4. Histórico e concorrência

`cupons_utilizacoes` registra cliente, agendamento, regra, bruto, elegível, desconto, status e timestamps. A confirmação valida limite total e limite por cliente sob lock do cupom. Usos concorrentes não ultrapassam o limite. Cancelamento/no-show libera a utilização sem contaminar o histórico de atendimento concluído.

## 5. Interfaces

O Cliente informa/aplica/troca cupom, vê desconto e valor final, usa `?cupom=CODIGO` e recebe mensagens pt-BR. O Parceiro administra origem, influencer, regras/faixas, escopo, serviços, mínimo, limites, vigência e status. RLS e isolamento entre barbearias permanecem obrigatórios.

## 6. Critério de aceite

Os 33 cenários do pedido da Task 11 devem ser cobertos por testes de domínio, migração/RLS e fluxo de reserva, com typecheck e testes existentes sem regressão.
