# Relatório de Garantia da Qualidade (QA) — TASK-05: Marketplace e Jornada do Cliente

**Data de Avaliação**: 25/09/2026  
**Responsável**: Agente QA  
**Parecer**: APROVADO  

---

## 1. Auditoria de UX e Design System (`ui-ux-pro-max`)

| Critério | Avaliação | Detalhes |
|---|---|---|
| **Contraste de Cores (WCAG 2.2 AA)** | Conforme | Uso do cobre primário `#B45A2B` com variantes escuras e claras calibradas para contraste mínimo de 4.5:1. Badges com fundos suaves e bordas delimitadas. |
| **Touch Targets (Apple HIG / MD)** | Conforme | Todos os botões, links de ação e seletores interativos possuem altura mínima de 44px (`min-h-[44px]` ou classe `h-11`). |
| **Feedback de Interação** | Conforme | Estados de loading animados durante geolocalização, busca, confirmação de agendamento e cancelamento. |
| **Prevenção de Erros de Concorrência** | Conforme | Caso um horário seja ocupado enquanto o usuário se autentica, o sistema captura a exceção de exclusão GiST sem quebrar a UI e apresenta os slots alternativos disponíveis. |
| **Jornada de Mínimo Atrito** | Conforme | O usuário anônimo navega, escolhe serviço, barbeiro, data e horário livre sem bloqueio de login inicial. O rascunho é persistido de forma segura no `localStorage`. |

---

## 2. Cobertura de Testes Automatizados

- **Suíte Integrada (`scripts/testar.mjs`)**: 39 testes executados.
- **Taxa de Sucesso**: 100% (39 passados, 0 falhados).
- **Testes Unitários Específicos da Task 05**:
  - Validação de rascunho com `esquemaRascunhoReserva` (sucesso para campos válidos e profissional nulo; falha para datas em formato não ISO, horários inválidos e duração zero).
  - Cálculo Haversine de distância geográfica (`calcularDistanciaKm`) com precisão urbana.
  - Verificação de migração SQL: RPC `buscar_barbearias_marketplace` com grants para `anon` e `authenticated`.

---

## 3. Verificação Estática de Tipos

- O comando `npx tsc --noEmit` foi executado no workspace `apps/cliente` sem nenhum erro relatado.

---

## 4. Conclusão do QA

Todos os critérios de aceite estabelecidos no `TASK.md` foram integralmente atendidos. A task está liberada para o aceite final do Product Owner.

## Evolução — seleção de múltiplos serviços (25/11/2026)

| Critério | Resultado | Evidência |
|---|---|---|
| Selecionar de um a três serviços | Conforme | Interface, validação do rascunho e RPC limitam o conjunto a três |
| Somar duração e preço antes de escolher horário | Conforme | Soma no domínio/UI; cobertura unitária soma 30 + 20 + 10 minutos |
| Exibir profissionais habilitados para todos os serviços | Conforme | Vínculos `profissionais_servicos` filtram as opções específicas |
| Distribuir “Qualquer profissional” pela menor carga diária | Conforme | A RPC ordena os candidatos pela contagem de reservas ativas no banco |
| Revalidar duração e disponibilidade após login | Conforme | RPC recalcula duração a partir do banco antes de confirmar |
| Preservar seleção pré-login e salvar snapshot por serviço | Conforme | Rascunho mantém compatibilidade antiga e grava vários itens em `agendamentos_servicos` |
| Testes automatizados | Aprovado | 325 testes passaram no branch de DEV |
| Typecheck e build | Aprovado | `npm run typecheck` e `npm run build` passaram no branch isolado de DEV |
| Lint global | Aprovado | `npm run lint` passou sem erros; há warnings preexistentes em vários workspaces |
| Migration em DEV | Aprovado | Migration `20261125212728` aplicada e confirmada no projeto Barzzo Dev; RPC e permissões verificadas. A conferência de reserva no navegador fica após o deploy |

**Parecer:** gates automatizados aprovados e migration aplicada em DEV. Falta conferir o fluxo de reserva no domínio de DEV após a publicação.
