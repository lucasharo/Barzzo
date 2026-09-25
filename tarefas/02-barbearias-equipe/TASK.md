# TASK-02 — Barbearias, onboarding e equipe

## Objetivo
Criar barbearia, dono, onboarding, equipe e convites.

## Dados
barbearias, membros_barbearia, profissionais, convites_profissionais e registro inicial do trial.

## Regras
Criador vira dono. Usuário pode ter várias barbearias. Profissional pode existir sem conta e depois aceitar convite. Papéis: dono, gerente, profissional. Trial: 30 dias.

## Onboarding
Dados, endereço/contato, horários básicos, equipe e checklist. Serviços/fotos podem apontar para tasks seguintes sem bloquear esta entrega.

## Rotas
/parceiro/painel
/parceiro/onboarding
/parceiro/equipe
/parceiro/equipe/[id]
/parceiro/convites
/parceiro/configuracoes/perfil

## UX
ui-ux-pro-max obrigatório; checklist e estados de convite claros.

## Testes
Criar barbearia, múltiplas, profissional sem conta, convite/expiração, aceite, gerente/profissional sem permissão indevida, isolamento tenant, regressão Task 01.

## Aceite
Dono cria barbearia/equipe; profissional aceita convite; RLS validada; trial registrado.
