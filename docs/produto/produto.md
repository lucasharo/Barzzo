# Produto Barzzo

## Visão
Marketplace para clientes encontrarem e reservarem barbearias + SaaS de gestão para barbearias + aquisição por cupons/influenciadores.

## Perfis
Cliente, Dono, Gerente, Profissional, Influenciador, Admin Barzzo.

## Cliente
Busca por nome/localização, perfil público, serviços, profissionais, horários, produtos, galeria, favoritos, avaliações e reserva. Pode montar reserva sem login; autenticação só antes de confirmar.

## Parceiro
Dashboard, agenda, clientes, profissionais, serviços, horários, bloqueios, produtos, galeria, campanhas, influenciadores, relatórios, assinatura e configurações.

## Profissional
Própria agenda, atendimentos, clientes necessários, disponibilidade, perfil e indicadores próprios.

## Influenciador
Código/link, campanhas, cliques quando rastreáveis, reservas, concluídos, comissão pendente/paga.

## Admin
Barbearias, usuários, trials, assinaturas, agendamentos, influenciadores, moderação e logs.

## Fluxo de cliente
Início -> busca -> perfil -> serviço -> profissional/qualquer -> data/horário -> resumo -> login se necessário -> revalidar -> confirmar.

## Fluxo dono
Conta -> criar barbearia -> dono -> trial 30 dias -> auto-cadastro como profissional -> configuração de horários/jornada -> serviços -> equipe adicional -> fotos -> barbearia visível na busca.

## Dono como Profissional e Visibilidade na Busca
- **Auto-cadastro:** Ao registrar a barbearia (`criar_barbearia_com_dono`), os dados do proprietário criam automaticamente um perfil profissional em `profissionais` (ativo = true).
- **Horário Pendente:** A jornada de trabalho semanal do dono não é criada por padrão, permanecendo com status "Horário pendente".
- **Regra de Visibilidade no Marketplace:** Enquanto a barbearia não possuir **ao menos um profissional com horário semanal ativo** (`barbearia_possui_horarios_ativos`), ela fica **ocultada da busca de clientes** (`buscar_barbearias_com_distancia`) e dos destaques da tela inicial. O parceiro é alertado no painel e na gestão de equipe com atalhos para cadastrar a jornada e ativar a visibilidade pública da barbearia.

## Profissional convidado
Dono cria profissional sem conta -> convite -> profissional autentica -> aceita -> vincula conta -> recebe permissões.

## Atendimento
confirmado -> iniciar (inicio_real) -> em_atendimento -> finalizar (fim_real) -> concluido. Alternativas: cancelado, nao_compareceu.

## Relatórios
Geral e por profissional: atendimentos, faturamento estimado, ticket médio, ocupação, serviços e tempo previsto x real.

## Assinaturas, Planos e Pagamentos (Mercado Pago)
- **Trial:** 30 dias gratuitos sem cartão obrigatório na criação da barbearia.
- **Ciclos e Desconto em Plano/Ciclo Maior:** Os planos disponibilizam ciclos de faturamento (mensal, semestral, anual). Ciclos mais longos oferecem desconto proporcional expressivo sobre o custo mensal, além de extensão promocional do período (+30 dias no plano semestral), preservando integralmente o histórico da barbearia.
- **Bloqueio de Regressão de Plano (Downgrade):** Durante o período vigente de uma assinatura ativa, **não é permitida a regressão (downgrade) de plano**. Upgrades de plano e transições para ciclos superiores entram em vigor imediatamente. Qualquer cancelamento ou redução de plano só passa a valer após o encerramento do ciclo já pago.
- **Tokenização de Cartão de Crédito:** O pagamento de assinaturas via cartão de crédito utiliza tokenização segura diretamente no frontend com o SDK do Mercado Pago. O Barzzo nunca recebe nem armazena número de cartão de crédito ou código de segurança (CVV). São armazenados apenas referências de tokenização (`token`, `ultimos_digitos`, `bandeira` e validade) na tabela `cartoes_salvos` para renovações e gestão pelo parceiro.

## Dentro do MVP
Auth, barbearia, equipe, serviços, disponibilidade, agenda, reservas, marketplace, clientes, favoritos, avaliações, catálogo, galeria, campanhas, influencers, push, relatórios, assinatura, admin, PWA.

## Fora do MVP
Pagamento de serviços no app, multa/sinal, ecommerce, e-mail, WhatsApp, estoque avançado, pontos, repasse automático, DRE, apps nativos publicados.
