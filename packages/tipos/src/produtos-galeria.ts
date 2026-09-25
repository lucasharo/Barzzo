// packages/tipos/src/produtos-galeria.ts
// Tipos para catálogo de produtos e galeria de fotos do Barzzo.

export interface Produto {
  id: string;
  barbearia_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  foto_url: string | null;
  ativo: boolean;
  destaque: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface FotoGaleria {
  id: string;
  barbearia_id: string;
  titulo: string | null;
  foto_url: string;
  destaque_capa: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}
