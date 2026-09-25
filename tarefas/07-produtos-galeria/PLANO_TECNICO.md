# Plano Técnico — TASK-07: Produtos, Galeria e Imagens

**Arquiteto / Líder Técnico**: Agente Líder Técnico  
**Data**: 25/09/2026  
**Status**: Aprovado para Implementação  

---

## 1. Visão Geral da Arquitetura

A Task 07 tem como objetivo criar a vitrine presencial de produtos (pomadas, óleos, balms, shampoos) e a galeria visual de fotos dos estabelecimentos (cortes, ambiente, equipe), equipando a plataforma com um **pipeline de processamento de mídia no cliente**.

### Princípios Técnicos:
- **Sem E-commerce Complexo**: Os produtos representam catálogo de conveniência presencial (disponíveis para compra na barbearia).
- **Processamento Pré-Upload Obrigatório**: Nenhuma imagem é transmitida sem validação de tipo MIME, conferência de tamanho e redimensionamento proporcional via Canvas (máximo 800x800 para produtos e 1200x1200 para fotos de galeria).
- **Exclusão Segura**: Ao substituir ou remover uma foto, o arquivo associado é referenciado ou substituído no storage sem deixar lixo órfão.

---

## 2. Modelagem de Dados e Banco de Dados (Supabase / Postgres)

### 2.1 Tabela `produtos`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `nome` TEXT NOT NULL
- `descricao` TEXT
- `preco` NUMERIC(10,2) NOT NULL CHECK (preco >= 0)
- `foto_url` TEXT
- `ativo` BOOLEAN NOT NULL DEFAULT true
- `destaque` BOOLEAN NOT NULL DEFAULT false
- `ordem` INT NOT NULL DEFAULT 0
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 2.2 Tabela `galeria_fotos`
- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `barbearia_id` UUID NOT NULL REFERENCES `barbearias(id)` ON DELETE CASCADE
- `titulo` TEXT
- `foto_url` TEXT NOT NULL
- `destaque_capa` BOOLEAN NOT NULL DEFAULT false
- `ordem` INT NOT NULL DEFAULT 0
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 2.3 Row Level Security (RLS)
- **`produtos`**:
  - SELECT: Público para produtos ativos (`ativo = true`) e para membros da barbearia.
  - INSERT/UPDATE/DELETE: Apenas membros ativos da equipe da barbearia.
- **`galeria_fotos`**:
  - SELECT: Público para barbearias ativas.
  - INSERT/UPDATE/DELETE: Apenas membros ativos da equipe da barbearia.

---

## 3. Pipeline de Imagens e Processamento

1. **Validação**: Tipos aceitos `image/jpeg`, `image/png`, `image/webp`. Tamanho máximo de entrada 5MB.
2. **Redimensionamento Proporcional**:
   - Produtos: caixa delimitadora de 800x800 px.
   - Galeria de Fotos: caixa delimitadora de 1200x1200 px.
3. **Compressão**: Canvas com exportação em WebP/JPEG qualidade 0.85.
4. **Storage**: Buckets `produtos` e `galeria` configurados com acesso público de leitura.

---

## 4. Telas a Desenvolver

- **`apps/parceiro`**:
  - `/produtos`: Catálogo de produtos da barbearia (grid de cards com foto, preço, switch de ativo/inativo, destaque).
  - `/produtos/[id]`: Edição e cadastro de produto com upload de foto e preview instantâneo.
  - `/galeria`: Gestão da galeria de fotos (upload, marcar como capa, ordenação e exclusão).
- **`apps/cliente`**:
  - Integração no perfil público da barbearia (`/barbearias/[slug]`):
    - Seção "Galeria de Fotos" com grade de imagens e visualização ampliada.
    - Seção "Produtos Disponíveis" exibindo vitrine com foto, preço e descrição.

---

## 5. Plano de Testes

- Validação de produtos (rejeitar preço negativo, nome curto).
- Validação de fotos de galeria (rejeitar URL vazia).
- Redimensionamento proporcional (fotos verticais, horizontais e quadradas dentro do limite).
- Exclusão e substituição de foto.
- Migração SQL com RLS e índices.
