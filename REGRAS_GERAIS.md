# Regras gerais do Barzzo MVP

## Negócio
- Barzzo = marketplace + SaaS para barbearias.
- Receita do MVP: assinatura da barbearia.
- Cliente final não paga assinatura.
- Pagamento de corte/produto não passa pelo Barzzo no MVP.
- Produtos são catálogo, sem ecommerce.
- Sem e-mail no MVP.
- Push e central interna entram.
- Trial padrão: 30 dias.
- Retenção: +30 dias pode ser concedido ao contratar plano semestral, como benefício auditável.
- Comissão de influenciador é registrada, mas paga pela barbearia fora da plataforma.

## Agendamento
- Visitante navega e chega ao resumo sem login.
- Login só antes da confirmação definitiva.
- Seleção sobrevive à autenticação.
- Pode escolher profissional ou "qualquer profissional".
- "Qualquer": elegível/disponível com distribuição equilibrada por carga do dia.
- Revalidar disponibilidade no momento de gravar.
- Impedir dupla reserva no banco/transação.
- Status: pendente, confirmado, em_atendimento, concluido, cancelado, nao_compareceu.
- Guardar inicio_previsto, fim_previsto, inicio_real, fim_real.
- Snapshot de nome/preço/duração dos serviços.
- Cancelamento/reagendamento sem multa/sinal no MVP.

## Usuários/equipe
- Um usuário pode ser cliente, profissional, gerente e dono em contextos distintos.
- Permissão vem de vínculos, não de role global.
- Profissional pode existir sem conta e depois aceitar convite.
- Pode trabalhar em várias barbearias.
- Papéis: dono, gerente, profissional.

## Serviços/agenda
- Serviço: nome, descrição, preço, duração, ativo.
- No MVP preço/duração iguais para profissionais.
- Disponibilidade = funcionamento + jornada - bloqueios - reservas.
- Profissional nunca fica disponível fora do funcionamento.

## Clientes
- Histórico oficial vem de agendamentos.
- Observações internas nunca aparecem ao cliente.
- Avaliação apenas de atendimento concluído, uma por agendamento, nota 1-5.

## Imagens
- Supabase Storage oficial.
- Firebase não armazena imagens.
- Toda imagem é validada, redimensionada e comprimida antes do upload.
- Perfil: referência máxima 800x800.
- Banco guarda caminho/URL, não bytes.

## Influenciadores
- Campanha pode existir sem influencer.
- Desconto percentual ou fixo.
- Pode ter validade, limite, primeira reserva e serviços elegíveis.
- Comissão só após concluído.
- Status: pendente, paga, cancelada.

## Tecnologia
- Next.js + React + TypeScript.
- Tailwind + shadcn/ui.
- PWA primeiro; preparar Capacitor.
- Supabase: PostgreSQL, Auth, Storage.
- Firebase: somente Cloud Messaging.
- Vercel inicialmente.
- PostGIS para proximidade.
- Banco snake_case, português sem acentos.
- RLS obrigatório em tabelas expostas.
- Multi-tenant obrigatório.
- Nunca expor secret/service key.

## UX
Mobile-first, touch-friendly, acessível, com loading/vazio/erro/sucesso. ux-pro-max obrigatório.
