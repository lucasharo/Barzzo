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
Cupons associados, campanhas, reservas atribuídas, concluídos, comissão pendente/paga. Links novos divulgam diretamente `?cupom=CODIGO`; `ref` é apenas compatibilidade de navegação e não cria atribuição.

No Parceiro, os dados do influenciador e seu status ativo/inativo podem ser editados. Um influenciador inativo não recebe novas atribuições por cupom; alterações de status ou comissão não recalculam comissões já congeladas em agendamentos anteriores.

## Cupons e atribuição comercial
- O cupom aplicado na reserva é a única fonte de atribuição comercial.
- Cada reserva tem no máximo um cupom. Um novo cupom substitui o anterior.
- O cupom é reaplicado em cada agendamento e não é herdado de reservas anteriores.
- Cupons podem possuir múltiplas regras/faixas, com prioridade, histórico por barbearia ou global Barzzo, serviços elegíveis, valor mínimo, limites e desconto percentual/fixo.
- No Parceiro, o histórico considerado é sempre o da própria barbearia; cupons globais e regras com histórico de todo o Barzzo são exclusivos do Admin.
- No formulário do Parceiro, `Apenas 1ª Reserva` fica na seção de demais atendimentos: quando ligado, seus campos ficam ocultos e um aviso informa que não haverá desconto nessa faixa; quando desligado, os campos são exibidos. Os limites por cliente são independentes entre faixas, enquanto o limite total permanece compartilhado pelo cupom.
- O agendamento congela o snapshot comercial no momento da confirmação; comissão percentual usa o líquido e comissão fixa usa o valor congelado.

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

## Revisão de regras comerciais

As regras de cupons e influencers descritas na Task 08 continuam como histórico de implementação, mas foram superseded pela Task 11. A fonte de verdade atual é o cupom associado ao agendamento, nunca o parâmetro `ref`.

## Fora do MVP
Pagamento de serviços no app, multa/sinal, ecommerce, e-mail, WhatsApp, estoque avançado, pontos, repasse automático, DRE, apps nativos publicados.

## Planos e unidades

A única diferença de funcionalidade entre os planos é a quantidade de filiais (cadastradas em **Unidades da Rede**). Os demais recursos do produto são os mesmos em todos os planos; os limites de profissionais continuam como na vitrine.

| Plano | Unidades |
|---|---|
| Solo | somente a própria barbearia |
| Pro | somente a própria barbearia |
| Growth | matriz + 1 filial |
| Rede | matriz + filiais ilimitadas |

- A filial nasce ativa e **herda a assinatura da matriz**, sem trial nem cobrança própria. Se a matriz ficar inadimplente, as filiais também ficam.
- Só o dono da matriz, com assinatura ativa, cadastra filiais. O limite é conferido no banco (`criar_filial`, com a matriz travada para evitar criação simultânea acima do limite; coluna `planos.limite_filiais`, `NULL` = ilimitadas).
- Cada unidade tem a própria agenda, equipe, serviços, clientes e horários. Quem tem mais de uma unidade escolhe a unidade em uso pelo seletor do menu.
- Assinatura e vínculo de rede não são editáveis pelo app: só o backend (webhook, chave de serviço) e o Admin alteram essas colunas.

## Influenciadores do Barzzo

Influenciador da plataforma, sem barbearia, que as barbearias podem aceitar.

- **Cadastro próprio:** o influenciador cria a conta no app do Parceiro (`/influenciador/cadastro`), informa nome, WhatsApp, chave Pix e o código do cupom. Cada usuário tem um cadastro de influenciador do Barzzo.
- **Cupom pendente:** nasce com 5% de comissão e fica pendente até o Admin aprovar. Enquanto não for aprovado, o cupom é recusado em qualquer barbearia. O influenciador pode trocar o código enquanto estiver pendente ou recusado; depois de aprovado, só o Admin altera.
- **Desconto do cliente:** 15% no primeiro atendimento (histórico global do Barzzo, não só da barbearia) e 5% nos demais.
- **Admin altera tudo:** comissão (percentual ou valor fixo), os dois descontos, aprovação, recusa e ativação, na tela Rede de Influenciadores. Alterações valem para os próximos atendimentos; o snapshot da reserva preserva as condições do momento.
- **Aceite da barbearia:** interruptor "Aceitar influenciadores do Barzzo" (Influenciadores & Afiliados). Ligado, vale para todos os influenciadores aprovados, inclusive os futuros. Desligado por padrão.
- **Quem paga:** a barbearia onde o cupom foi usado paga a comissão (5% por padrão, sobre o valor líquido) e vê o influenciador no extrato.
- Os influenciadores cadastrados pela própria barbearia continuam como antes.
