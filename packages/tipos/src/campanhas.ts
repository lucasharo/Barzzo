// packages/tipos/src/campanhas.ts
// Tipos para campanhas promocionais, cupons de desconto e influenciadores parceiros.

export type TipoDescontoCupom = "percentual" | "valor_fixo";
export type TipoComissaoInfluenciador = "percentual" | "valor_fixo";
export type StatusComissaoInfluenciador = "pendente" | "paga" | "cancelada";
export type StatusIndicacao = "pendente" | "concluido" | "cancelado";
export type OrigemCupom = "BARBEARIA" | "INFLUENCIADOR" | "BARZZO_GLOBAL";
export type EscopoHistoricoCupom = "BARBEARIA" | "GLOBAL_BARZZO";
export type StatusUtilizacaoCupom = "reservado" | "consumido" | "liberado" | "cancelado";

export interface Campanha {
  id: string;
  barbearia_id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cupom {
  id: string;
  barbearia_id: string;
  campanha_id: string | null;
  codigo: string;
  descricao: string | null;
  tipo_desconto: TipoDescontoCupom;
  valor_desconto: number;
  valor_minimo_reserva: number;
  limite_usos_total: number | null;
  usos_atuais: number;
  limite_usos_por_cliente: number;
  apenas_primeira_reserva: boolean;
  servicos_elegiveis?: string[];
  origem?: OrigemCupom;
  influenciador_id?: string | null;
  regras?: CupomRegra[];
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CupomRegra {
  id: string;
  cupom_id: string;
  prioridade: number;
  escopo_historico: EscopoHistoricoCupom;
  atendimentos_minimos: number | null;
  atendimentos_maximos: number | null;
  tipo_desconto: TipoDescontoCupom;
  valor_desconto: number;
  valor_minimo_reserva: number;
  limite_usos_total: number | null;
  limite_usos_por_cliente: number | null;
  servicos_elegiveis: string[];
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface CupomUtilizacao {
  id: string;
  cupom_id: string;
  regra_id: string | null;
  cliente_id: string | null;
  agendamento_id: string | null;
  status: StatusUtilizacaoCupom;
  valor_bruto: number;
  subtotal_elegivel: number;
  valor_desconto: number;
  regra_aplicada: Record<string, unknown>;
  reservado_em: string;
  consumido_em: string | null;
  liberado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Influenciador {
  id: string;
  barbearia_id: string;
  usuario_id: string | null;
  nome: string;
  codigo_ref: string;
  email: string | null;
  telefone: string | null;
  chave_pix: string | null;
  tipo_comissao: TipoComissaoInfluenciador;
  valor_comissao: number;
  cupom_padrao_id: string | null;
  ativo: boolean;
  cliques_rastreados: number;
  created_at: string;
  updated_at: string;
}

export interface Indicacao {
  id: string;
  barbearia_id: string;
  influenciador_id: string;
  cupom_id: string | null;
  agendamento_id: string | null;
  cliente_id: string | null;
  codigo_ref_usado: string;
  status: StatusIndicacao;
  created_at: string;
}

export interface ComissaoInfluenciador {
  id: string;
  barbearia_id: string;
  influenciador_id: string;
  indicacao_id: string | null;
  agendamento_id: string;
  valor_servicos: number;
  tipo_comissao: TipoComissaoInfluenciador;
  taxa_comissao: number;
  valor_comissao: number;
  status: StatusComissaoInfluenciador;
  paga_em: string | null;
  created_at: string;
  updated_at: string;
  cupom_id?: string | null;
  codigo_cupom?: string | null;
  origem_cupom?: OrigemCupom | null;
  subtotal_elegivel?: number;
  valor_liquido?: number;
  // Joins opcionais
  influenciadores?: {
    nome: string;
    codigo_ref: string;
    chave_pix: string | null;
  } | null;
}

export interface ResultadoValidacaoCupom {
  valido: boolean;
  motivo_invalido?: string;
  cupom?: Cupom;
  valor_desconto_calculado?: number;
  subtotal_elegivel?: number;
  valor_final?: number;
  regra_aplicada?: CupomRegra;
}
