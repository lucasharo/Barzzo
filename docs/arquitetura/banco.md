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

agendamentos deve conter barbearia_id, cliente_id, profissional_id, inicio_previsto, fim_previsto, inicio_real, fim_real, status, observacoes e timestamps.

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
influenciadores
campanhas_influenciadores
indicacoes
comissoes_influenciadores

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
