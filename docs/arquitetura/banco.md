# Banco de dados conceitual

UUID para IDs; timestamptz para datas relevantes; snake_case em português.

## Núcleo
usuarios
barbearias
membros_barbearia
profissionais
convites_profissionais

- `criar_barbearia_com_dono`: RPC atômica que cria a barbearia, vincula o dono em `membros_barbearia` e cria automaticamente o perfil do proprietário em `profissionais` (com `ativo = true` e horários semanais pendentes).
- `barbearia_possui_horarios_ativos(p_barbearia_id UUID)`: Função que verifica se a barbearia tem ao menos um profissional com `jornadas_profissionais.ativo = true`.
- `buscar_barbearias_com_distancia`: RPC da busca do marketplace do cliente que exige `barbearia_possui_horarios_ativos(b.id) = true`, ocultando barbearias sem horários cadastrados.

## Agenda
servicos
profissionais_servicos
horarios_barbearia
jornadas_profissionais
bloqueios_agenda
agendamentos
agendamentos_servicos

Além dos dados operacionais, `agendamentos` possui snapshot comercial imutável: `cupom_id`, código/origem do cupom, influencer atribuído, valor bruto dos serviços, subtotal elegível, desconto, valor líquido, regra aplicada e tipo/taxa/valor da comissão. O cupom e o influencer são referências históricas; alteração posterior de cadastro não recalcula o agendamento.

Uma reserva tem no máximo um cupom e uma atribuição comercial. O vínculo atual é `cupons.influenciador_id`; `influenciadores.cupom_padrao_id` permanece somente para compatibilidade histórica e não é usado como fonte de verdade.

agendamentos_servicos preserva snapshot do nome, preço e duração.

## Clientes
clientes_barbearia
observacoes_clientes
favoritos
avaliacoes

## Conteúdo
produtos
galeria_fotos

## Marketing
campanhas
cupons
cupons_regras
cupons_utilizacoes
influenciadores
campanhas_influenciadores
indicacoes
comissoes_influenciadores

`cupons_regras` representa faixas extensíveis por prioridade, intervalo de atendimentos anteriores, escopo (`BARBEARIA` ou `GLOBAL_BARZZO`), benefício, serviços elegíveis, valor mínimo e limites. `cupons_utilizacoes` registra individualmente os estados `reservado`, `consumido`, `liberado` e `cancelado`, com valores e regra aplicada. A contagem de limites é feita sob lock da linha do cupom na RPC de confirmação, não no frontend.

No fluxo atual, uma utilização é criada como `consumido` na confirmação definitiva; cancelamento ou não comparecimento muda o registro para `liberado` e não gera comissão. `reservado` fica disponível para fluxos transacionais intermediários e `cancelado` para invalidações explícitas auditadas.

`comissoes_influenciadores` tem no máximo uma linha por agendamento (`UNIQUE(agendamento_id)`) e usa exclusivamente o snapshot do agendamento. Influencer desativado não impede a comissão de reserva já confirmada.

## Sistema
dispositivos
notificacoes
planos
assinaturas
beneficios_assinatura
cartoes_salvos
logs_auditoria

- `cartoes_salvos`: Armazena tokens de cartão de crédito tokenizados no frontend via Mercado Pago (`token_cartao`, `ultimos_digitos`, `bandeira`, `mes_expiracao`, `ano_expiracao`, `titular_nome`). Não armazena dados sensíveis (PAN ou CVV).
- `assinaturas`: Registra a contratação de planos com suporte a ciclos (mensal, semestral, anual). Ciclos superiores aplicam desconto proporcional progressivo e bônus de trial estendido (+30 dias no semestral). Bloqueio de regressão (downgrade) garante que planos não possam ser rebaixados durante a vigência de um ciclo ativo já quitado.

## Multi-tenant
Entidades privadas devem carregar barbearia_id quando isso fortalece isolamento e RLS.

## Concorrência
Sobreposição de agenda deve ser impedida no banco/transação, não apenas pela UI. A Task 04 define a estratégia final.

Limites de cupons seguem a mesma regra: a RPC bloqueia o cupom, valida usos totais e por cliente, seleciona uma única faixa elegível e registra a utilização na mesma transação. Dois últimos usos concorrentes não podem ambos ser aceitos.

### Evolução da Task 08

A migration `20260925000007_campanhas_cupons_influenciadores.sql` é histórica e não deve ser editada. A Task 11 adiciona a migration incremental para vínculo cupom-influencer, regras/faixas, histórico de utilizações e snapshots. A atribuição legada por `ref` foi superseded e não deve ser usada em novas operações.
