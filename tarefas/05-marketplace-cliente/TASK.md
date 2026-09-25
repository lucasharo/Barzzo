# TASK-05 — Marketplace e jornada do cliente

## Objetivo
Descoberta pública e reserva com login somente no final.

## Rotas
/inicio
/barbearias
/barbearias/[slug]
/reservar/*
/agendamentos
/agendamentos/[id]

## Busca
Nome, localização, distância, serviço, preço, nota quando disponível, aberto agora e próximo horário quando viável. PostGIS para proximidade.

## Perfil público
Capa/logo, descrição, endereço, horário, serviços/preços, profissionais, galeria, produtos, avaliações, localização e CTA Agendar.

## Fluxo
Pesquisa -> perfil -> serviço -> profissional/qualquer -> data/horário -> resumo -> autenticar se anônimo -> recuperar seleção -> revalidar -> criar -> confirmação.

Não criar reserva definitiva antes da autenticação.

## Estado pré-login
Preservar barbearia, serviço, profissional, data, horário e referência futura de cupom/influencer.

## UX
ui-ux-pro-max obrigatório com foco em conversão e mínimo atrito.

## Testes
Fluxo anônimo completo, login sem perder seleção, horário ocupado durante login, sem disponibilidade, geolocalização negada, mobile, público/privado e regressão.

## Aceite
Visitante chega ao resumo sem login e confirma após autenticar sem refazer escolhas.
