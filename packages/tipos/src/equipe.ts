export type PapelEquipe = "dono" | "gerente" | "profissional";

export interface MembroBarbearia {
  id: string;
  barbearia_id: string;
  usuario_id: string;
  papel: PapelEquipe;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  usuario?: {
    id: string;
    nome: string;
    email: string;
    foto_url: string | null;
    telefone: string | null;
  };
}

export interface Profissional {
  id: string;
  barbearia_id: string;
  usuario_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  bio: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ConviteProfissional {
  id: string;
  barbearia_id: string;
  profissional_id: string;
  email: string;
  papel: "gerente" | "profissional";
  token: string;
  status: "pendente" | "aceito" | "recusado" | "expirado";
  expira_em: string;
  criado_em: string;
  respondido_em?: string | null;
  profissional?: Profissional;
}
