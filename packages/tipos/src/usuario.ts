import type { Database } from "./banco";

export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type NovoUsuario = Database["public"]["Tables"]["usuarios"]["Insert"];
export type AtualizarUsuario = Database["public"]["Tables"]["usuarios"]["Update"];

export interface SessaoUsuario {
  id: string;
  email: string;
  nome: string;
  telefone?: string | null;
  foto_url?: string | null;
}

export interface RespostaAutenticacao {
  sucesso: boolean;
  mensagem?: string;
  usuario?: Usuario | null;
}
