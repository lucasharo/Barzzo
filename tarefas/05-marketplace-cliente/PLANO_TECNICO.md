# Plano Técnico — TASK-05: Marketplace e Jornada do Cliente

## 1. Visão Geral da Arquitetura

A TASK-05 foca na aplicação do cliente (`apps/cliente`), proporcionando uma experiência de busca, descoberta e agendamento rápida, responsiva e com **zero atrito**.

### Diretrizes de Produto e Segurança Obrigatórias
1. **Público até o Resumo**: Pesquisa de barbearias, visualização de catálogo, consulta de horários e seleção de serviços são 100% públicas, sem exigência de conta ou login prévio.
2. **Preservação de Estado Pré-Login**: Quando um visitante anônimo chega ao resumo da reserva e é solicitado a autenticar ou criar conta, sua seleção completa (barbearia, serviço, profissional, data, horário, observações e cupom) é armazenada de forma segura no `localStorage` sob a chave `@barzzo:rascunho_reserva`.
3. **Revalidação Concorrente Pós-Login**: Antes de confirmar a reserva definitiva no banco de dados, o sistema revalida atomicamente se o horário escolhido ainda está disponível. Se outro cliente reservou o mesmo slot durante o tempo em que o usuário fazia login, o sistema apresenta feedback claro e oferece os horários alternativos imediatos, sem obrigar o cliente a reconfigurar o serviço.
4. **Reserva Definitiva Apenas Autenticada**: Nenhuma reserva definitiva ou bloqueio de agenda falso é criado no banco de dados antes da autenticação do cliente.
5. **Área Privada do Cliente**: Rota `/agendamentos` exibindo o histórico e os agendamentos futuros do cliente autenticado, com opção de cancelamento respeitando regras de antecedência.

---

## 2. Estrutura do Banco de Dados e Migrations

Arquivo: `supabase/migrations/20260925000004_marketplace_e_busca.sql`

### Funções e Otimizações
1. **Cálculo de Distância Haversine (PostgreSQL)**:
   - Função `calcular_distancia_km(lat1, lon1, lat2, lon2)` para calcular distância geográfica entre cliente e barbearia.
2. **RPC `public.buscar_barbearias_marketplace`**:
   - Parâmetros: `p_termo TEXT DEFAULT NULL`, `p_cidade TEXT DEFAULT NULL`, `p_estado TEXT DEFAULT NULL`, `p_latitude NUMERIC DEFAULT NULL`, `p_longitude NUMERIC DEFAULT NULL`, `p_raio_km NUMERIC DEFAULT 50`.
   - Retorna barbearias ativas com cálculo de distância, quantidade de serviços ativos e horários de hoje.
3. **RLS**:
   - Garante `SELECT` irrestrito para dados públicos de `barbearias`, `servicos`, `profissionais` e `horarios_barbearia`.

---

## 3. Pacotes Compartilhados (`packages/*`)

### `@barzzo/tipos`
- `RascunhoReserva`:
  ```ts
  export interface RascunhoReserva {
    barbearia_id: string;
    barbearia_nome: string;
    barbearia_slug: string;
    servico_id: string;
    servico_nome: string;
    preco: number;
    duracao_minutos: number;
    profissional_id: string | null; // null = qualquer
    profissional_nome?: string;
    data: string; // "YYYY-MM-DD"
    horario: string; // "HH:MM"
    observacoes?: string | null;
    codigo_cupom?: string | null;
  }
  ```
- `BarbeariaMarketplace`, `FiltrosBuscaMarketplace`.

### `@barzzo/validacoes`
- `esquemaRascunhoReserva`: Validação Zod da estrutura armazenada no storage local.

### `@barzzo/dominio`
- `calcularDistanciaKm(lat1, lon1, lat2, lon2)`: Implementação em TypeScript puro da fórmula de Haversine para cálculo de proximidade no cliente.
- `gerenciadorRascunhoReserva`: Utilitários para salvar, carregar e limpar `@barzzo:rascunho_reserva`.

---

## 4. Telas e Aplicações no `apps/cliente`

Rotas:
- **`/`**: Home do cliente com hero de busca conectada ao banco, barbearias em destaque e filtros rápidos.
- **`/barbearias`**: Lista do marketplace com barra de pesquisa, filtro por cidade, ordenação por proximidade e cards com CTA "Ver Perfil".
- **`/barbearias/[slug]`**: Perfil público da barbearia com dados institucionais, endereço, horário de funcionamento semanal, catálogo de serviços com preços e durações, equipe de barbeiros e CTA "Agendar Horário".
- **`/reservar/[slug]`**: Wizard de reserva em 4 passos:
  - Passo 1: Seleção de Serviço
  - Passo 2: Seleção de Profissional (ou "Qualquer Profissional Disponível")
  - Passo 3: Escolha de Data e Horário (slots em tempo real)
  - Passo 4: Resumo da Reserva.
    - Se usuário autenticado: Botão "Confirmar Agendamento".
    - Se anônimo: Salva rascunho e direciona para `/entrar?retorno=/reservar/[slug]/confirmar`.
- **`/reservar/[slug]/confirmar`**: Tela pós-login que carrega o rascunho salvo, revalida disponibilidade e insere o agendamento no Supabase com confirmação visual.
- **`/agendamentos`**: Painel "Meus Agendamentos" para clientes autenticados, com abas "Próximos" e "Histórico".
- **`/agendamentos/[id]`**: Detalhes do agendamento do cliente com opção de cancelamento de agendamentos futuros.

---

## 5. Padrões de Design System e UX (`ui-ux-pro-max`)

- **Funil de Conversão Sem Atrito**: Visitante escolhe tudo antes de ser obrigado a se identificar.
- **Indicador de Etapas no Wizard**: Barra de progresso clara com 4 etapas numeradas.
- **Cores Semânticas**:
  - Destaque cobre `#B45A2B` para botões de agendamento e avanço de etapa.
  - Verde `#16A34A` para confirmação e horários livres.
  - Azul `#2563EB` para agendamentos confirmados na área do cliente.
- **Touch targets >= 44x44px** e responsividade impecável em smartphones.

---

## 6. Estratégia de Testes Automatizados

1. **Testes do Rascunho Pré-Login e Domínio**:
   - Validação Zod do `esquemaRascunhoReserva`.
   - Cálculo de distância Haversine em km.
   - Simulação de revalidação de disponibilidade quando o horário ainda está livre vs quando foi ocupado.
2. **Testes de Busca e Proximidade**:
   - Ordenação correta por menor distância geográfica.
3. **Testes de Migração SQL**:
   - Função `calcular_distancia_km` e RPC `buscar_barbearias_marketplace`.
   - Políticas de leitura pública das entidades da barbearia.
