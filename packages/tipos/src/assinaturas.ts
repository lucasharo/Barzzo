// packages/tipos/src/assinaturas.ts
// Tipos para planos SaaS, assinaturas e benefícios de retenção.

export type IdentificadorPlano = "solo" | "pro" | "growth" | "rede";

export type CicloAssinatura = "mensal" | "semestral";

export type StatusAssinatura =
  | "trial"
  | "ativa"
  | "vencida"
  | "suspensa"
  | "cancelada";

export interface Plano {
  id: string;
  identificador: IdentificadorPlano;
  nome: string;
  descricao: string | null;
  limite_profissionais: number | null; // null = ilimitado
  preco_mensal: number;
  preco_semestral: number;
  ativo: boolean;
  ordem: number;
  recursos: string[];
  criado_em: string;
}

export interface Assinatura {
  id: string;
  barbearia_id: string;
  plano_id: string;
  ciclo: CicloAssinatura;
  status: StatusAssinatura;
  data_inicio: string;
  data_fim: string;
  data_cancelamento: string | null;
  mercado_pago_subscription_id: string | null;
  mercado_pago_payment_id: string | null;
  valor: number;
  criado_em: string;
  atualizado_em: string;
  // Join opcional com planos
  planos?: Plano | null;
}

export interface BeneficioAssinatura {
  id: string;
  barbearia_id: string;
  tipo: "extensao_trial" | "desconto" | "dias_bonus";
  dias_concedidos: number;
  motivo: string;
  concedido_por: string;
  criado_em: string;
}
