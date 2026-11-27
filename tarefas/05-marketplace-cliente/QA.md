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
| Selecionar de um a três serviços | Conforme localmente | Interface, validação do rascunho e RPC limitam o conjunto a três |
| Somar duração e preço antes de escolher horário | Conforme localmente | Soma no domínio/UI; cobertura unitária soma 30 + 20 + 10 minutos |
| Exibir profissionais habilitados para todos os serviços | Conforme localmente | Vínculos `profissionais_servicos` filtram as opções específicas |
| Distribuir “Qualquer profissional” pela menor carga diária | Conforme no contrato local | A RPC ordena os candidatos pela contagem de reservas ativas no banco |
| Revalidar duração e disponibilidade após login | Conforme localmente | RPC recalcula duração a partir do banco antes de confirmar |
| Preservar seleção pré-login e salvar snapshot por serviço | Conforme localmente | Rascunho mantém compatibilidade antiga e grava vários itens em `agendamentos_servicos` |
| Testes automatizados | Aprovado | 329 testes passaram |
| Typecheck e build | Aprovado | Typecheck global e build global passaram; Cliente também passou após o ajuste final |
| Lint global | Reprovado por bloqueio preexistente | `packages/nativo/src/push-web.ts:13` contém ponto e vírgula extra; lint do Cliente passou |
| Migration no banco e fluxo real | Pendente | Não aplicada nem publicada em DEV; Docker/psql local ausente e a conexão Supabase atual negou acesso ao projeto Barzzo |

**Parecer:** implementação local validada. A liberação do fluxo integrado depende da migration e da publicação do app no ambiente.
