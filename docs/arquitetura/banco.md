# Banco de dados conceitual

UUID para IDs; timestamptz para datas relevantes; snake_case em português.

## Núcleo
usuarios
barbearias
membros_barbearia
profissionais
convites_profissionais

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
logs_auditoria

## Multi-tenant
Entidades privadas devem carregar barbearia_id quando isso fortalece isolamento e RLS.

## Concorrência
Sobreposição de agenda deve ser impedida no banco/transação, não apenas pela UI. A Task 04 define a estratégia final.
