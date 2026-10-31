# TASK-12 — Influenciadores globais do Barzzo

## Objetivo

Permitir que promotores e influenciadores digitais se cadastrem de forma independente na plataforma Barzzo (sem necessidade de vínculo prévio a uma barbearia específica), gerem seu cupom comercial exclusivo e recebam comissões auditáveis sobre atendimentos concluídos nas barbearias parceiras que optarem por aceitar os influenciadores da rede Barzzo.

## Contexto & Decisão de Produto

Historicamente, os influenciadores pertenciam exclusivamente a uma única barbearia (`influenciadores.barbearia_id`). Conforme decisão formal de produto de 24/10/2026 ([[decisoes/barzzo/2026-10-24-influenciadores-do-barzzo]]), o Barzzo passa a contar com influenciadores da rede Barzzo (globais), com as seguintes regras de negócio:

1. **Cadastro autônomo**: o influenciador acessa `/influenciador/cadastro`, cria conta e cadastra seus dados (nome, WhatsApp, chave Pix) e o código desejado para o cupom.
2. **Cupom pendente de aprovação**: o cupom nasce vinculado à origem `BARZZO_GLOBAL`, com status `pendente` e comissão padrão de 5%. Somente administradores do Barzzo podem aprovar, recusar ou alterar as taxas.
3. **Desconto de cliente**: no primeiro atendimento em qualquer barbearia da rede, o cliente recebe 15% de desconto; nos demais atendimentos, recebe 5% de desconto (regras com escopo `GLOBAL_BARZZO`).
4. **Poder do Admin**: no painel Admin (`/influenciadores`), o administrador pode aprovar/recusar o cupom, alterar os percentuais de desconto do 1º e demais atendimentos, alterar a comissão (percentual ou valor fixo) e ativar/desativar o influenciador.
5. **Interruptor de aceite na barbearia**: em `/influenciadores`, a barbearia parceira possui o interruptor "Aceitar influenciadores do Barzzo". Quando ativado, os cupons aprovados passam a ser aceitos em agendamentos daquela unidade; se desativado, o cupom é recusado pelo backend.
6. **Pagamento da comissão**: a comissão é calculada e congelada no snapshot do agendamento e é de responsabilidade da barbearia parceira onde o atendimento foi concluído, aparecendo no extrato financeiro da unidade.
7. **Portal do influenciador**: em `/influenciador/painel`, o influenciador consulta o status do seu cupom, comissões pendentes e pagas, copia o código ou link de divulgação e pode solicitar troca de código caso ainda não esteja aprovado.

## Escopo Técnico

- Migration de banco (`20261024000600_influenciadores_do_barzzo.sql`) com constraints multi-tenant/globais, RPCs `cadastrar_influenciador_barzzo`, `alterar_cupom_influenciador_barzzo`, `admin_decidir_cupom_global`, `admin_atualizar_influenciador_global`, `obter_meu_cupom_barzzo` e regras RLS seguras.
- Aplicação Parceiro:
  - Rota e tela `/influenciador/cadastro`
  - Rota e tela `/influenciador/painel`
  - Toggle de aceite em `/influenciadores`
  - Acesso pelo menu lateral (`NavegacaoParceiro`) e redirecionamento de login
- Aplicação Admin:
  - Listagem separada de influenciadores do Barzzo e promotores locais em `/influenciadores`
  - Ações de aprovação, recusa e modal de edição completa
- Testes automatizados de segurança, banco e cálculo de descontos em `tests/seguranca/influenciadores-barzzo.test.ts`.

## Estado

AGUARDANDO_ACEITE_PO
