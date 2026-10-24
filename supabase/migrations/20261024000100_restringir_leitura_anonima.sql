-- Endurecimento de acesso, parte 2: leitura anônima restrita ao que é público.
-- Aplicar DEPOIS do deploy dos apps que usam colunas explícitas (barbearias, profissionais,
-- avaliacoes) e as RPCs obter_cupom_por_codigo / obter_convite_por_token.

-- Cupons deixam de ser listáveis por qualquer visitante (use obter_cupom_por_codigo).
DROP POLICY IF EXISTS "Leitura pública de cupons ativos para validação" ON public.cupons;
DROP POLICY IF EXISTS "Leitura pública das regras de cupons ativos" ON public.cupons_regras;

-- A leitura pública de produtos não pode consultar tabelas restritas (o anon não tem
-- acesso a elas); a equipe já vê tudo pela policy de gestão da barbearia.
DROP POLICY IF EXISTS "Qualquer pessoa pode visualizar produtos ativos" ON public.produtos;
CREATE POLICY "Produtos ativos sao publicos"
    ON public.produtos FOR SELECT TO anon, authenticated
    USING (ativo = true);

-- ============================================================================
-- 5. Privilégios: anon só lê o que é público; nada de escrita
-- ============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT SELECT ON
    public.servicos,
    public.horarios_barbearia,
    public.jornadas_profissionais,
    public.profissionais_servicos,
    public.galeria_fotos,
    public.produtos,
    public.planos
TO anon;

-- Colunas públicas (sem documento, dados de cobrança, e-mail/telefone de profissionais ou
-- identificadores de quem avaliou).
GRANT SELECT (
    id, nome, slug, telefone, email, endereco, bairro, cidade, estado, cep,
    latitude, longitude, logo_url, foto_capa_url, status_assinatura, trial_fim,
    ativa, criado_em, atualizado_em
) ON public.barbearias TO anon;

GRANT SELECT (id, barbearia_id, nome, foto_url, bio, ativo) ON public.profissionais TO anon;

GRANT SELECT (
    id, barbearia_id, cliente_nome, profissional_id, nota, comentario,
    resposta_barbearia, respondido_em, created_at, updated_at
) ON public.avaliacoes TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

