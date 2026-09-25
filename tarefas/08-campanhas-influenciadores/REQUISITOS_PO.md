# Requisitos de Produto — TASK-08: Campanhas, Cupons e Influenciadores

**Product Owner (PO)**: Agente PO  
**Data**: 25/09/2026  
**Status**: Aprovado para o Líder Técnico  

---

## 1. Visão Geral e Objetivos do Produto

A barbearia moderna precisa de canais ágeis de aquisição de clientes. A Task 08 introduz no Barzzo dois motores complementares de crescimento:
1. **Campanhas e Cupons Promocionais**: Descontos configuráveis pelas barbearias para atrair clientes em horários calmos ou fidelizar novos frequentadores.
2. **Programa de Influenciadores Parceiros**: Barbearias podem cadastrar criadores de conteúdo ou promotores locais, associando links e cupons personalizados, com comissões automáticas calculadas pelo sistema sobre atendimentos concluídos.

> [!IMPORTANT]
> **Sem Fluxo Financeiro no Barzzo**: A plataforma não opera como intermediária de pagamento nem retém valores de comissões. O Barzzo calcula, audita a elegibilidade, rastreia a atribuição e disponibiliza o extrato. O acerto de contas físico ou via Pix é realizado diretamente entre a barbearia e o influenciador.

---

## 2. Regras de Negócio e Validações

### 2.1 Cupons e Campanhas
- **Tipos de Desconto**:
  - `percentual`: ex: 15% de desconto.
  - `valor_fixo`: ex: R$ 10,00 de desconto no serviço.
- **Restrições Configuráveis**:
  - `data_inicio` e `data_fim`: Cupons não podem ser aplicados antes ou depois da janela de vigência.
  - `limite_usos_total`: Quantidade máxima de vezes que o cupom pode ser resgatado.
  - `limite_usos_por_cliente`: Geralmente 1 por cliente.
  - `apenas_primeira_reserva`: Se verdadeiro, apenas clientes sem nenhum agendamento anterior concluído na barbearia podem aplicar o cupom.
  - `valor_minimo_reserva`: O cupom só é válido se o valor dos serviços atingir o patamar mínimo (ex: acima de R$ 50,00).
  - `servicos_elegiveis`: Lista de IDs de serviços permitidos ou vazio (todos permitidos).

### 2.2 Atribuição de Influenciadores e Persistência
- O influenciador possui um código único / slug de referência (ex: `BARBAVIP`).
- Parâmetros `?ref=CODIGO` ou `?cupom=CODIGO` capturados no cliente são gravados em `@barzzo:atribuicao_influenciador` no `localStorage`.
- A atribuição sobrevive a toda a navegação pelas telas de busca, perfil da barbearia e processo de autenticação.
- Ao confirmar o agendamento, o código da indicação é registrado na tabela `indicacoes`.

### 2.3 Cálculo e Idempotência de Comissões
- **Gatilho de Comissão**: A comissão é gerada **única e exclusivamente** quando o agendamento atinge o status `concluido`.
- **Idempotência**: Cada agendamento pode gerar no máximo 1 comissão (restrição `UNIQUE(agendamento_id)` em `comissoes_influenciadores`).
- **Cancelamento e No-Show**:
  - Agendamentos cancelados ou marcados como "não compareceu" **NUNCA** geram comissão.
  - Se um agendamento for cancelado antes da conclusão, a indicação vinculada tem seu status cancelado.
- **Tipos de Comissão**:
  - `percentual`: Percentual sobre o valor total concluído dos serviços (ex: 10%).
  - `valor_fixo`: Valor fixo em reais por atendimento concluído (ex: R$ 8,00 por corte).
- **Status da Comissão**: `pendente` (aguardando acerto pela barbearia), `paga` (acertada pelo dono), `cancelada`.

---

## 3. Telas e Experiência do Usuário (UX)

- **Parceiro (`apps/parceiro`)**:
  - `/campanhas`: Painel de campanhas ativas, encerradas, total de cupons utilizados e descontos aplicados.
  - `/campanhas/[id]`: Criação e edição de campanhas e cupons com parâmetros completos.
  - `/influenciadores`: Gestão de influenciadores credenciados, link de indicação para copiar, comissões pendentes e botão "Marcar como Paga".
- **Área do Influenciador (`apps/parceiro` / `/influenciador`)**:
  - `/influenciador/painel`: Dashboard com cliques rastreados, agendamentos gerados, atendimentos concluídos e total a receber.
  - `/influenciador/campanhas`: Links personalizados para divulgação em redes sociais e WhatsApp.
  - `/influenciador/comissoes`: Extrato detalhado com histórico de comissões, data, valor e status.
- **Cliente (`apps/cliente`)**:
  - Campo intuitivo "Possui cupom de desconto?" na tela de confirmação (`/reservar/[slug]/confirmar`).
  - Feedback visual instantâneo com valor deduzido em destaque verde (`#16A34A`).
  - Preenchimento automático caso o cliente tenha entrado via link de influenciador/campanha.

---

## 4. Critérios de Aceite

1. Cupons respeitam rigorosamente datas de vigência, limites de uso e valor mínimo.
2. Apenas clientes novos conseguem usar cupons marcados como "apenas primeira reserva".
3. A comissão do influenciador é gerada com precisão atômica apenas após conclusão do serviço.
4. Nenhuma comissão é gerada para agendamentos cancelados ou no-shows.
5. Idempotência absoluta contra duplicação de comissões.
6. Design system Barzzo e touch targets >= 44x44px em todas as novas telas.
